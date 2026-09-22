import { inngest } from "../config/inngest.js";
import {
  planProject,
  generateFileContent,
  fixFile,
  buildDependencyBatches,
  extractErrorFilePath,
  extractMissingPackage,
  DailyTokenLimitError,
} from "../agents/coding.agent.js";
import type { ExecutionPlan } from "../agents/coding.agent.js";

import { prisma } from "../config/db.js";
import { getIO } from "../socket/io.js";
import { createSession } from "../session/createSession.js";
import { sessions } from "../session/session.manager.js";

import { executeCommand, sendInput } from "../tools/executeCommand.js";

import { nextEvent } from "../services/runtime-events.js";
import type { RuntimeEvent } from "../services/runtime-events.js";

import { readWorkspaceFile, writeWorkspaceFile } from "../tools/code.tool.js";

import { ensureContainerRunning } from "../services/docker.service.js";

import fs from "fs/promises";
import path from "path";

import type { ProjectSession } from "../types/session.js";

// ============================================================
// CONFIG
// ============================================================

const MAX_FIX_ATTEMPTS = 3;
const MAX_VERIFY_EVENTS = 20;
const MAX_STOP_DRAIN_EVENTS = 10;

// ============================================================
// RUNTIME EVENT SUMMARIES
// ============================================================

function truncate(text: string, max = 400): string {
  const clean = text.trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max) + ` …(truncated, ${clean.length} chars total)`;
}

function summarizeRuntimeEvent(event: RuntimeEvent): string {
  switch (event.kind) {
    case "promptDetected":
      return `Prompt detected: ${truncate(event.text, 200)}`;
    case "commandCompleted":
      return `success=${event.success}; output: ${truncate(event.stdout)}`;
    case "previewReady":
      return `Preview VERIFIED READY on port ${event.hostPort}. HTTP check passed.`;
    case "previewError":
      return `Preview verification FAILED: ${truncate(event.reason, 2000)}`;
    case "previewStopped":
      return `Dev server stopped. Workspace still exists.`;
  }
}

// ============================================================
// WORKSPACE LISTING
// ============================================================

async function listWorkspaceFiles(workspacePath: string, relativePath: string): Promise<string> {
  const root = path.resolve(workspacePath);
  const resolved = path.resolve(workspacePath, relativePath);

  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error("Path escapes workspace.");
  }

  const entries = await fs.readdir(resolved, { withFileTypes: true });

  const lines = entries
    .sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    })
    .map((entry) => {
      const type = entry.isDirectory() ? "DIR " : "FILE";
      const childPath = relativePath === "." ? entry.name : `${relativePath}/${entry.name}`;
      return `${type} ${childPath}`;
    });

  return lines.length > 0 ? lines.join("\n") : "(empty directory)";
}

// ============================================================
// SESSION
// ============================================================

async function getCodingSession(projectId: string): Promise<ProjectSession> {
  const existing = sessions.get(projectId);
  if (existing) return existing;

  console.log(`No live session for project ${projectId}. Recreating coding session.`);

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error(`Project ${projectId} does not exist.`);
  if (!project.containerId) throw new Error(`Project ${projectId} has no containerId.`);

  await ensureContainerRunning(project.containerId);
  return createSession(project, getIO());
}

// ============================================================
// PREVIEW WAIT — drains events until a TERMINAL one arrives.
// ============================================================

async function waitForPreviewOutcome(
  session: ProjectSession,
): Promise<{ ready: true } | { ready: false; reason: string }> {
  for (let i = 0; i < MAX_VERIFY_EVENTS; i++) {
    const evt = await nextEvent(session);
    console.log("Verify — intermediate event:", summarizeRuntimeEvent(evt));

    if (evt.kind === "previewReady") {
      return { ready: true };
    }
    if (evt.kind === "previewError") {
      return { ready: false, reason: evt.reason };
    }
    if (evt.kind === "previewStopped") {
      return { ready: false, reason: "Dev server stopped unexpectedly before becoming ready." };
    }
  }

  return {
    ready: false,
    reason: `No previewReady/previewError event after draining ${MAX_VERIFY_EVENTS} runtime events.`,
  };
}

// ============================================================
// STOP ACTIVE COMMAND — drains until commandCompleted specifically.
// ============================================================

async function stopActiveCommandAndDrain(session: ProjectSession): Promise<void> {
  /*
   * FIX: declare intent BEFORE sending the interrupt.
   *
   * STOP DETECTION in createSession.js used to fire off a pure
   * `/\^C/.test(terminalBuffer)` text match while state was
   * READY/STARTING. terminalBuffer is only cleared when STOP
   * DETECTION itself fires or when a new attempt's port is
   * extracted — NOT the instant a real Ctrl+C is sent — so a
   * leftover `^C` echo from THIS stop could still be sitting in
   * the buffer when the NEXT verify attempt starts and flips state
   * back to STARTING, killing the new (possibly now-fixed) attempt
   * for a reason unrelated to it, before it ever reached the HTTP
   * probe. Setting this flag lets STOP DETECTION require an actual
   * requested stop in addition to the text match, so a stray or
   * delayed `^C`-shaped byte sequence can never masquerade as an
   * intentional stop again.
   */
  session.stopRequested = true;

  sendInput(session, "\u0003");

  for (let i = 0; i < MAX_STOP_DRAIN_EVENTS; i++) {
    const evt = await nextEvent(session);
    console.log("Stop drain — event:", summarizeRuntimeEvent(evt));

    if (evt.kind === "commandCompleted") {
      return;
    }
  }

  console.log(
    `WARNING: no commandCompleted observed after ${MAX_STOP_DRAIN_EVENTS} drained events following Ctrl+C. ` +
      `Proceeding anyway — the next executeCommand call may throw if bookkeeping wasn't cleaned up.`,
  );
  /*
   * Note: if the ^C echo never arrived within the drain window,
   * session.stopRequested is intentionally left true here. It's
   * safe to leave set — it only ever gates a genuine ^C text match
   * inside createSession.js's STOP DETECTION and is cleared there
   * the moment that match is consumed. It never triggers a stop by
   * itself.
   */
}

// ============================================================
// CODING WORKFLOW
// ============================================================

export const codingWorkflow = inngest.createFunction(
  {
    id: "coding-workflow",
    retries: 2,
    triggers: [{ event: "project/coding.requested" }],

    onFailure: async ({ event, error }) => {
      const originalEvent = event.data.event as
        | { data?: { projectId?: string } }
        | undefined;
      const projectId = originalEvent?.data?.projectId;
      console.error("Coding workflow failed:", projectId, error);
    },
  },

  async ({ event, step }) => {
    const { projectId, prompt, setupContext, setupResult } = event.data;

    console.log(`Starting coding workflow for project ${projectId}`);
    console.log("Setup context:", setupContext);
    console.log("Setup result:", setupResult);

    const session = await getCodingSession(projectId);
    const setupOutput = JSON.stringify(setupResult, null, 2);

    await step.run("stop-setup-dev-server", async () => {
      if (session.preview.state === "READY") {
        console.log("Dev server from Setup Agent is running — stopping it before coding begins.");
        await stopActiveCommandAndDrain(session);
        return "Dev server was stopped before coding began.";
      }
      return "No dev server was running at handoff.";
    });

    try {
      // ====================================================
      // PHASE 1: PLAN
      // ====================================================

      const workspaceListing = await step.run("list-workspace", () =>
        listWorkspaceFiles(session.workspacePath, ".")
      );

      const plan: ExecutionPlan = await step.run("plan", () =>
        planProject({
          projectId,
          userPrompt: prompt,
          setupContext,
          setupOutput,
          workspaceListing,
        })
      );

      console.log(`Plan produced ${plan.files.length} files, ${plan.setupCommands.length} setup commands`);

      // ====================================================
      // PHASE 2: SETUP COMMANDS
      // ====================================================

      for (let i = 0; i < plan.setupCommands.length; i++) {
        const command = plan.setupCommands[i]!;
        await step.run(`setup-command-${i}`, async () => {
          console.log("===== SETUP COMMAND =====");
          console.log(command);
          console.log("==========================");
          executeCommand(session, command);
          const evt = await nextEvent(session);
          console.log("Setup command result:", summarizeRuntimeEvent(evt));
          return summarizeRuntimeEvent(evt);
        });
      }

      // ====================================================
      // PHASE 3: GENERATE FILES
      // ====================================================

      const batches = buildDependencyBatches(plan.files);
      const writtenContent: Record<string, string> = {};

      console.log(`Generating ${plan.files.length} files across ${batches.length} batches`);

      for (let b = 0; b < batches.length; b++) {
        const batch = batches[b]!;

        console.log(`Batch ${b + 1}/${batches.length}: ${batch.map((f) => f.path).join(", ")}`);

        const results = await Promise.all(
          batch.map((file) =>
            step.run(`generate-${file.path}`, async () => {
              const dependencyContents: Record<string, string> = {};
              for (const dep of file.dependsOn) {
                if (writtenContent[dep]) dependencyContents[dep] = writtenContent[dep];
              }

              let existingContent: string | undefined;
              if (file.action === "modify") {
                try {
                  existingContent = await readWorkspaceFile(session.workspacePath, file.path);
                } catch {
                  // File listed as "modify" but doesn't exist yet — treat as create.
                }
              }

              // exactOptionalPropertyTypes: only include the key when there's
              // an actual value — passing `existingContent: undefined`
              // explicitly is a type error against an optional `?: string`.
              const content = await generateFileContent({
                file,
                userPrompt: prompt,
                setupContext,
                dependencyContents,
                ...(existingContent !== undefined ? { existingContent } : {}),
              });

              await writeWorkspaceFile(session.workspacePath, file.path, content);

              return { path: file.path, content };
            })
          )
        );

        for (const { path: filePath, content } of results) {
          writtenContent[filePath] = content;
        }
      }

      // ====================================================
      // PHASE 4: VERIFY — start dev server, drain events until
      // a terminal outcome. On failure: check for a missing
      // package first, otherwise patch the file NAMED IN THE
      // LOG, not just whichever file was written last.
      // ====================================================

      let previewReady = false;
      let lastError: string | null = null;

      for (let fixAttempt = 0; fixAttempt <= MAX_FIX_ATTEMPTS; fixAttempt++) {
        const verifyResult = await step.run(`verify-${fixAttempt}`, async () => {
          console.log("===== VERIFY: STARTING DEV SERVER =====");
          console.log(plan.verifyCommand);
          console.log("========================================");

          executeCommand(session, plan.verifyCommand);
          return waitForPreviewOutcome(session);
        });

        if (verifyResult.ready) {
          previewReady = true;
          break;
        }

        lastError = verifyResult.reason;

        if (fixAttempt === MAX_FIX_ATTEMPTS) {
          console.log(`Exhausted ${MAX_FIX_ATTEMPTS} fix attempts. Last error: ${lastError}`);
          break;
        }

        const missingPackage = extractMissingPackage(lastError);

        if (missingPackage) {
          console.log(`Detected missing package: ${missingPackage} — installing instead of patching a file.`);

          await step.run(`install-missing-${fixAttempt}-${missingPackage}`, async () => {
            executeCommand(session, `npm install ${missingPackage}`);
            const evt = await nextEvent(session);
            console.log("Install result:", summarizeRuntimeEvent(evt));
            return summarizeRuntimeEvent(evt);
          });

          await step.run(`stop-failed-server-${fixAttempt}`, () => stopActiveCommandAndDrain(session));
          continue;
        }

        const identifiedPath = extractErrorFilePath(lastError, Object.keys(writtenContent));
        const targetPath = identifiedPath ?? Object.keys(writtenContent).reverse()[0];

        if (!targetPath) {
          console.log("No files to fix — aborting.");
          break;
        }

        console.log(
          `Targeting fix at: ${targetPath} (${identifiedPath ? "identified from error log" : "fallback: last written"})`,
        );

        const targetFile = plan.files.find((f) => f.path === targetPath)!;

        const fixedContent = await step.run(`fix-${fixAttempt}-${targetPath}`, async () => {
          const content = await fixFile({
            file: targetFile,
            currentContent: writtenContent[targetPath]!,
            buildError: lastError!,
          });
          await writeWorkspaceFile(session.workspacePath, targetPath, content);
          return content;
        });

        writtenContent[targetPath] = fixedContent;

        await step.run(`stop-failed-server-${fixAttempt}`, () => stopActiveCommandAndDrain(session));
      }

      if (!previewReady) {
        throw new Error(
          `Coding workflow finished generating files but could not verify a working preview after ${MAX_FIX_ATTEMPTS} fix attempts. Last error: ${lastError}`
        );
      }

      const result = {
        success: true,
        reason: `Generated ${plan.files.length} files across ${batches.length} batches and verified the preview.`,
        previewReady: true,
        hostPort: session.preview.hostPort,
      };

      console.log(`Coding workflow completed for project ${projectId}`);
      console.log("Coding result:", result);

      return result;
    } catch (err) {
      if (err instanceof DailyTokenLimitError) {
        console.error(
          `Daily token limit hit for project ${projectId}. ` +
            `Retry after ~${err.retryAfterSeconds ?? "unknown"}s. Consider switching providers.`
        );
      }
      throw err;
    }
  }
);