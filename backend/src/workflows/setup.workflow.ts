import { inngest } from "../config/inngest.js";
import { NonRetriableError } from "inngest";
import { prisma } from "../config/db.js";
import { getIO } from "../socket/io.js";
import { createSession } from "../session/createSession.js";
import { ensureContainerRunning } from "../services/docker.service.js";
import { setupAgent } from "../agents/setup.agent.js";
import { sessions } from "../session/session.manager.js";

import { executeCommand, sendInput } from "../services/executeCommand.js";
import { nextEvent } from "../services/runtime-events.js";
import type { RuntimeEvent } from "../services/runtime-events.js";

import type { ProjectSession } from "../types/session.js";

/* ============================================================
   CONFIG

   Deterministic runtime safety invariants, not product/framework
   decisions. They bound how long the loop can run — they never
   decide what the agent should do next.
   ============================================================ */

const MAX_ITERATIONS = 40;

const MAX_RECOVERY_ATTEMPTS = 3;

/* ============================================================
   OBSERVATION BUILDER

   Turns a RuntimeEvent into plain, factual text for the agent.
   No recipes, no framework-specific instructions — just what
   happened. This is the only place that interprets an event;
   the loop itself never branches on where an event came from.
   ============================================================ */

function observationFromEvent(event: RuntimeEvent): string {
  switch (event.kind) {
    case "promptDetected":
      return event.text;

    case "commandCompleted":
      return event.stdout;

    case "previewReady":
      return `
The runtime reports that the preview has been verified.

Preview verification:
- Status: READY
- Host port: ${event.hostPort}
- HTTP preview check: PASSED

Decide whether setup is complete.
`;

    case "previewError":
      return `
The runtime reports that preview verification did not succeed.

Reason: ${event.reason}

The project workspace already exists — do not recreate it or reinstall dependencies unless the observation shows they are actually missing or broken.

If a development server appears to be running, use what you know about the project to determine whether it is configured correctly, and decide the appropriate next action.
`;

    case "previewStopped":
      return `
The runtime reports that the development server has stopped.

The project workspace and its files remain in place. Decide whether a server needs to be (re)started, and how, based on the project's own configuration.
`;
  }
}

/* ============================================================
   SESSION RECOVERY

   Recovery only gathers facts about the existing environment.
   It does not decide what should happen next — that is left
   entirely to the agent based on this observation.
   ============================================================ */

const RECOVERY_PROBE_COMMAND =
  'echo "--PACKAGE_JSON--" ; cat package.json 2>/dev/null || echo "(no package.json)" ; echo "--NODE_MODULES--" ; test -d node_modules && echo present || echo absent ; echo "--FILES--" ; ls -la';

async function getOrRecreateSession(
  projectId: string
): Promise<{
  session: ProjectSession;
  isRecovery: boolean;
  recoveryObservation?: string;
}> {
  const existing = sessions.get(projectId);

  if (existing) {
    return { session: existing, isRecovery: false };
  }

  console.log(
    `No live session for project ${projectId}. Recreating from persisted state.`
  );

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new NonRetriableError(
      `Project ${projectId} no longer exists. Cannot recover setup.`
    );
  }

  if (!project.containerId) {
    throw new NonRetriableError(
      `Project ${projectId} has no containerId. Cannot recreate its session.`
    );
  }

  if (project.setupAttempts >= MAX_RECOVERY_ATTEMPTS) {
    throw new NonRetriableError(
      `Project ${projectId} exceeded ${MAX_RECOVERY_ATTEMPTS} session-recovery attempts. Giving up.`
    );
  }

  await prisma.project.update({
    where: { id: projectId },
    data: { setupAttempts: { increment: 1 } },
  });

  /*
   * Reuse the SAME container and workspace.
   */
  await ensureContainerRunning(project.containerId);

  /*
   * Recreate the in-memory session. Preview detection is the
   * responsibility of createSession, not this workflow — we
   * don't probe ports or guess at server state here.
   */
  const session = await createSession(project, getIO());

  executeCommand(session, RECOVERY_PROBE_COMMAND);

  const probeEvent = await nextEvent(session);

  const workspaceProbeOutput =
    probeEvent.kind === "commandCompleted"
      ? probeEvent.stdout
      : observationFromEvent(probeEvent);

  const recoveryObservation = `
=== AI FORGE RECOVERY RUN ===

The previous setup session was lost and has just been recreated. The container and workspace are unchanged from before.

Current preview state: ${session.preview.state}

Workspace inspection:
${workspaceProbeOutput}

Previous durable setup status: ${project.setupStatus}
Previous error: ${project.setupError ?? "(none)"}

IMPORTANT:
- The project workspace already exists.
- Do not recreate it or rerun project creation unless this inspection shows that creation actually failed.
- Determine the current state of the project (framework, whether dependencies are installed, whether a server is running, whether the preview is verified) from the facts above and the workspace itself, and continue from there.
`;

  return { session, isRecovery: true, recoveryObservation };
}

/* ============================================================
   INNGEST WORKFLOW

   Generic orchestration loop only. The agent decides WHAT
   happens next; the runtime reports WHAT ACTUALLY HAPPENED via
   a single nextEvent(session) call. The workflow never races
   observation sources against each other and never interprets
   an event as belonging to a particular framework or tool.
   ============================================================ */

export const setupWorkflow = inngest.createFunction(
  {
    id: "setup-workflow",

    retries: 2,

    triggers: [{ event: "project/setup.requested" }],

    onFailure: async ({ event, error }) => {
      const originalEvent = event.data.event as
        | { data?: { projectId?: string } }
        | undefined;

      const projectId = originalEvent?.data?.projectId;

      if (!projectId) {
        console.error(
          "setup-workflow onFailure: could not determine projectId from failure event.",
          event
        );

        return;
      }

      await prisma.project.update({
        where: { id: projectId },
        data: {
          setupStatus: "FAILED",
          setupError:
            error?.message ?? "Setup failed after all retries.",
        },
      });
    },
  },

  async ({ event, step }) => {
    const { projectId, prompt } = event.data;

    /* ========================================================
       MARK SETUP IN PROGRESS
       ======================================================== */

    await step.run("mark-in-progress", async () => {
      const existing = await prisma.project.findUnique({
        where: { id: projectId },
        select: { setupAttempts: true },
      });

      await prisma.project.update({
        where: { id: projectId },
        data: {
          setupStatus: "IN_PROGRESS",
          setupError: null,
          ...(existing?.setupAttempts === null
            ? { setupAttempts: 0 }
            : {}),
        },
      });
    });

    /* ========================================================
       MAIN SETUP LOOP

       observation -> agent -> ONE action -> runtime executes it
       -> observation -> agent -> ... -> finish
       ======================================================== */

    const result = await step.run("setup-project", async () => {
      console.log(`Starting setup workflow for project ${projectId}`);

      const { session, isRecovery, recoveryObservation } =
        await getOrRecreateSession(projectId);

      console.log("Current sessions:", [...sessions.keys()]);

      let action = await setupAgent({
        projectId,
        prompt,
        observation: isRecovery ? recoveryObservation : undefined,
      });

      let iterations = 0;

      while (action.tool !== "finish") {
        iterations++;

        /*
         * Deterministic runtime safety invariant — not a
         * decision about the project.
         */
        if (iterations > MAX_ITERATIONS) {
          throw new Error(
            `Setup agent exceeded ${MAX_ITERATIONS} iterations without finishing. Aborting.`
          );
        }

        /* ==================================================
           EXECUTE COMMAND
           ================================================== */

        if (action.tool === "executeCommand") {
          console.log("===== EXECUTE COMMAND =====");
          console.log(action.command);
          console.log("============================");

          executeCommand(session, action.command);

          const evt = await nextEvent(session);

          action = await setupAgent({
            projectId,
            prompt,
            observation: observationFromEvent(evt),
          });

          continue;
        }

        /* ==================================================
           SEND INPUT

           Ctrl+C is not special-cased here. It is ordinary
           agent-controlled input: sendInput() writes it to the
           PTY, and whatever happens next — the shell returning,
           or the preview infrastructure noticing the server
           stopped — arrives as the next runtime event, the same
           as any other input.
           ================================================== */

        if (action.tool === "sendInput") {
          console.log("===== SEND INPUT =====");
          console.log("Input:", JSON.stringify(action.input));
          console.log("=======================");

          sendInput(session, action.input);

          const evt = await nextEvent(session);

          action = await setupAgent({
            projectId,
            prompt,
            observation: observationFromEvent(evt),
          });

          continue;
        }

        throw new Error(
          `Unknown agent action: ${JSON.stringify(action)}`
        );
      }

      /* ====================================================
         SETUP FINISHED
         ==================================================== */

      console.log("===== SETUP FINISHED =====");
      console.log(action.reason);

      /*
       * Deterministic product invariant, enforced regardless
       * of what the agent believes: the agent may only finish
       * once the runtime has independently verified the
       * preview.
       */
      const previewReady = session.preview.state === "READY";

      if (!previewReady) {
        throw new Error(
          "Agent finished setup without a verified preview."
        );
      }

      return {
        success: true,
        reason: action.reason,
        previewReady: true,
        hostPort: session.preview.hostPort,
      };
    });

    /* ========================================================
       RECORD FINAL RESULT
       ======================================================== */

    await step.run("record-setup-outcome", async () => {
      await prisma.project.update({
        where: { id: projectId },
        data: {
          setupStatus: result.previewReady ? "READY" : "FAILED",
          setupError: result.previewReady
            ? null
            : "Agent finished setup without a verified preview.",
        },
      });
    });

    return result;
  }
);