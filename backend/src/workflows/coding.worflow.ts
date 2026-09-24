import { inngest } from "../config/inngest.js";
import {
  planProject,
  generateFileContent,
  fixFile,
  triageRequest,
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
import {
  emitAgentStatus,
  emitFileStreamStart,
  emitFileDelta,
  emitFileStreamEnd,
  emitAgentMessage,
} from "../services/agent-status.js";

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
// PREVIEW WAIT
// ============================================================

async function waitForPreviewOutcome(
  session: ProjectSession,
): Promise<{ ready: true } | { ready: false; reason: string }> {
  for (let i = 0; i < MAX_VERIFY_EVENTS; i++) {
    const evt = await nextEvent(session);
    console.log("Verify — intermediate event:", summarizeRuntimeEvent(evt));

    if (evt.kind === "previewReady") return { ready: true };
    if (evt.kind === "previewError") return { ready: false, reason: evt.reason };
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
// STOP ACTIVE COMMAND
// ============================================================

async function stopActiveCommandAndDrain(session: ProjectSession): Promise<void> {
  session.stopRequested = true;
  sendInput(session, "\u0003");

  for (let i = 0; i < MAX_STOP_DRAIN_EVENTS; i++) {
    const evt = await nextEvent(session);
    console.log("Stop drain — event:", summarizeRuntimeEvent(evt));
    if (evt.kind === "commandCompleted") return;
  }

  console.log(
    `WARNING: no commandCompleted observed after ${MAX_STOP_DRAIN_EVENTS} drained events following Ctrl+C. ` +
      `Proceeding anyway.`,
  );
}

export const codingWorkflow = inngest.createFunction(
  {
    id: "coding-workflow",
    retries: 2,
    triggers: [{ event: "project/coding.requested" }],
    optimizeParallelism: false,
    onFailure: async ({ event, error }) => {
      const originalEvent = event.data.event as { data?: { projectId?: string } } | undefined;
      const projectId = originalEvent?.data?.projectId;
      console.error("Coding workflow failed:", projectId, error);
    },
  },

  async ({ event, step, runId, attempt }) => {
    const { projectId, prompt, setupContext, setupResult, isFollowUp, image } = event.data;

    try {
      console.log(`Starting coding workflow for project ${projectId}`);
      console.log(`[coding-workflow] run=${runId} attempt=${attempt} project=${projectId}`);
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

      // ====================================================
      // WORKSPACE LISTING
      // ====================================================

      const workspaceListing = await step.run("list-workspace", async () => {
        emitAgentStatus(projectId, "coding", "coding:planning", "Analyzing your request…");
        return listWorkspaceFiles(session.workspacePath, ".");
      });

      // ====================================================
      // PHASE 0: TRIAGE (follow-ups only)
      // ====================================================

      if (isFollowUp) {
        const triage = await step.run("triage", async () => {
          const result = await triageRequest({
            projectId,
            userPrompt: prompt,
            setupContext,
            workspaceListing,
            image,
          });

          emitAgentStatus(projectId, "coding", "coding:triage", `${result.mode} — ${result.reason}`);

          return result;
        });

        // ── chat: pure text reply, no action ──────────────
        if (triage.mode === "chat") {
          await step.run("send-chat-reply", async () => {
            emitAgentMessage(projectId, triage.reply!);
            emitAgentStatus(projectId, "coding", "coding:done", "Answered.");
          });

          return {
            success: true,
            reason: triage.reply!,
            previewReady: session.preview.state === "READY",
            hostPort: session.preview.hostPort,
          };
        }

        // ── run-command: start/restart the dev server ──────
        if (triage.mode === "run-command") {
          const runResult = await step.run("run-command", async () => {
            emitAgentStatus(
              projectId,
              "coding",
              "coding:verifying",
              "Starting dev server…",
            );

            // Stop any existing server first.
            if (session.preview.state === "READY") {
              console.log("Server already running — stopping before restart.");
              await stopActiveCommandAndDrain(session);
            }

            console.log("===== RUN COMMAND =====");
            console.log(triage.verifyCommand!);
            console.log("=======================");

            executeCommand(session, triage.verifyCommand!);
            return waitForPreviewOutcome(session);
          });

          if (runResult.ready) {
            await step.run("run-command-done", async () => {
              emitAgentStatus(projectId, "coding", "coding:done", "Preview is live.");
              emitAgentMessage(projectId, "Dev server started — the preview is live.");
            });

            return {
              success: true,
              reason: "Dev server started and preview verified.",
              previewReady: true,
              hostPort: session.preview.hostPort,
            };
          }

          // Server failed to start — fall through to full planning
          // so the Coding Agent can diagnose and fix whatever is broken.
          console.log(
            `run-command verify failed: ${runResult.reason}. Falling back to full planning.`,
          );

          emitAgentStatus(
            projectId,
            "coding",
            "coding:planning",
            "Server didn't start — replanning to diagnose and fix…",
          );
        }

        // ── quick-edit: patch one file then verify ─────────
        if (triage.mode === "quick-edit") {
          const targetPath = triage.targetFile!;

          await step.run(`quick-edit-${targetPath}`, async () => {
            emitAgentStatus(projectId, "coding", "coding:generating", `Editing ${targetPath}`, {
              file: targetPath,
            });

            const existingContent = await readWorkspaceFile(session.workspacePath, targetPath);

            emitFileStreamStart(projectId, targetPath);

            const content = await generateFileContent({
              file: { path: targetPath, action: "modify", description: prompt, dependsOn: [] },
              userPrompt: prompt,
              setupContext,
              dependencyContents: {},
              existingContent,
              image,
              onDelta: (delta) => emitFileDelta(projectId, targetPath, delta),
            });

            await writeWorkspaceFile(session.workspacePath, targetPath, content);
            emitFileStreamEnd(projectId, targetPath, content);
            return content;
          });

          if (triage.verifyCommand) {
            if (session.preview.state === "READY") {
              await step.run("stop-before-quick-verify", () => stopActiveCommandAndDrain(session));
            }

            const quickVerify = await step.run("verify-quick-edit", async () => {
              emitAgentStatus(projectId, "coding", "coding:verifying", "Starting dev server and checking preview…");
              executeCommand(session, triage.verifyCommand!);
              return waitForPreviewOutcome(session);
            });

            if (quickVerify.ready) {
              await step.run("send-quick-edit-done", async () => {
                emitAgentStatus(projectId, "coding", "coding:done", "Preview is live.");
                emitAgentMessage(projectId, `Updated ${targetPath} — the preview is live.`);
              });

              return {
                success: true,
                reason: `Quick-edited ${targetPath} and verified the preview.`,
                previewReady: true,
                hostPort: session.preview.hostPort,
              };
            }

            console.log(
              `Quick-edit verify failed for ${targetPath}: ${quickVerify.reason}. Falling back to full planning.`,
            );

            await step.run("stop-after-quick-verify-fail", () => stopActiveCommandAndDrain(session));
          } else {
            console.log(
              `Triage returned quick-edit for ${targetPath} with no verifyCommand — falling back to full planning.`,
            );
          }

          emitAgentStatus(
            projectId,
            "coding",
            "coding:planning",
            "Quick edit needs a full rebuild to verify — replanning…",
          );
        }

        // "full" falls straight through to full planning below.
      }

      // ====================================================
      // PHASE 1: PLAN
      // ====================================================

      const plan: ExecutionPlan = await step.run("plan", () =>
        planProject({
          projectId,
          userPrompt: prompt,
          setupContext,
          setupOutput,
          workspaceListing,
          ...(isFollowUp && image ? { image } : {}),
        }),
      );

      emitAgentStatus(projectId, "coding", "coding:planning", `Plan ready — ${plan.files.length} files`);
      console.log(`Plan produced ${plan.files.length} files, ${plan.setupCommands.length} setup commands`);

      // ====================================================
      // PHASE 2: SETUP COMMANDS
      // ====================================================

      for (let i = 0; i < plan.setupCommands.length; i++) {
        const command = plan.setupCommands[i]!;
        emitAgentStatus(projectId, "coding", "coding:setup-command", command);

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

      for (let b = 0; b < batches.length; b++) {
        const batch = batches[b]!;

        const results = await Promise.all(
          batch.map((file) =>
            step.run(`generate-${file.path}`, async () => {
              console.log(
                `[coding-workflow] generate-${file.path} EXECUTING — run=${runId} attempt=${attempt} batch=${b + 1}/${batches.length}`,
              );

              emitAgentStatus(projectId, "coding", "coding:generating", `Writing ${file.path}`, { file: file.path });

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

              emitFileStreamStart(projectId, file.path);

              const content = await generateFileContent({
                file,
                userPrompt: prompt,
                setupContext,
                dependencyContents,
                ...(existingContent !== undefined ? { existingContent } : {}),
                ...(isFollowUp && image ? { image } : {}),
                onDelta: (delta) => emitFileDelta(projectId, file.path, delta),
              });

              await writeWorkspaceFile(session.workspacePath, file.path, content);
              emitFileStreamEnd(projectId, file.path, content);
              emitAgentStatus(projectId, "coding", "coding:generating", `${file.path} done`, { file: file.path });

              return { path: file.path, content };
            }),
          ),
        );

        for (const { path: filePath, content } of results) {
          writtenContent[filePath] = content;
        }
      }

      // ====================================================
      // PHASE 4: VERIFY
      // ====================================================

      let previewReady = false;
      let lastError: string | null = null;

      for (let fixAttempt = 0; fixAttempt <= MAX_FIX_ATTEMPTS; fixAttempt++) {
        const verifyResult = await step.run(`verify-${fixAttempt}`, async () => {
          emitAgentStatus(projectId, "coding", "coding:verifying", "Starting dev server and checking preview…");

          console.log("===== VERIFY: STARTING DEV SERVER =====");
          console.log(plan.verifyCommand);
          console.log("========================================");

          executeCommand(session, plan.verifyCommand);
          return waitForPreviewOutcome(session);
        });

        if (verifyResult.ready) {
          await step.run(`send-build-done-${fixAttempt}`, async () => {
            emitAgentStatus(projectId, "coding", "coding:done", "Preview is live.");

            if (isFollowUp) {
              emitAgentMessage(
                projectId,
                `Build complete — generated ${plan.files.length} file${plan.files.length === 1 ? "" : "s"} and the preview is live.`,
              );
            }
          });

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
          console.log(`Detected missing package: ${missingPackage} — installing.`);
          emitAgentStatus(projectId, "coding", "coding:installing", `Installing ${missingPackage}…`);

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
          emitAgentStatus(projectId, "coding", "coding:fixing", `Fixing ${targetPath}`, {
            file: targetPath,
            attempt: fixAttempt + 1,
          });

          emitFileStreamStart(projectId, targetPath);

          const content = await fixFile({
            file: targetFile,
            currentContent: writtenContent[targetPath]!,
            buildError: lastError!,
            onDelta: (delta) => emitFileDelta(projectId, targetPath, delta),
          });

          await writeWorkspaceFile(session.workspacePath, targetPath, content);
          emitFileStreamEnd(projectId, targetPath, content);
          return content;
        });

        writtenContent[targetPath] = fixedContent;

        await step.run(`stop-failed-server-${fixAttempt}`, () => stopActiveCommandAndDrain(session));
      }

      if (!previewReady) {
        throw new Error(
          `Coding workflow finished generating files but could not verify a working preview after ${MAX_FIX_ATTEMPTS} fix attempts. Last error: ${lastError}`,
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
      emitAgentStatus(
        projectId,
        "coding",
        "error",
        err instanceof Error ? err.message : String(err),
      );

      if (err instanceof DailyTokenLimitError) {
        console.error(
          `Daily token limit hit for project ${projectId}. Retry after ~${err.retryAfterSeconds ?? "unknown"}s.`,
        );
      }

      throw err;
    }
  },
);
