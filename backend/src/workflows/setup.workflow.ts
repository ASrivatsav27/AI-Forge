import { inngest, codingRequested } from "../config/inngest.js";
import { NonRetriableError } from "inngest";
import { prisma } from "../config/db.js";
import { getIO } from "../socket/io.js";
import { createSession } from "../session/createSession.js";
import { ensureContainerRunning } from "../services/docker.service.js";
import {
  setupAgent,
  AgentActionParseError,
} from "../agents/setup.agent.js";
import type { AgentAction } from "../agents/setup.agent.js";
import { sessions } from "../session/session.manager.js";
import {
  executeCommand,
  sendInput,
} from "../tools/executeCommand.js";
import { nextEvent } from "../services/runtime-events.js";
import type { RuntimeEvent } from "../services/runtime-events.js";
import type { ProjectSession } from "../types/session.js";
import { emitAgentStatus } from "../services/agent-status.js";

type SetupContext = {
  framework: string;
  backend?: string;
  database?: string;
  architecture?: string;
  connectionString?: string;
};

type SetupResult = {
  success: boolean;
  previewReady: boolean;
  hostPort?: string;
  devCommand?: string;
  reason: string;
};

const MAX_ITERATIONS = 40;
const MAX_RECOVERY_ATTEMPTS = 3;

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
    return {
      session: existing,
      isRecovery: false,
    };
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
    data: {
      setupAttempts: {
        increment: 1,
      },
    },
  });

  await ensureContainerRunning(project.containerId);

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

  return {
    session,
    isRecovery: true,
    recoveryObservation,
  };
}

export const setupWorkflow = inngest.createFunction(
  {
    id: "setup-workflow",
    retries: 2,
    triggers: [
      {
        event: "project/setup.requested",
      },
    ],

    onFailure: async ({ event, error }) => {
      const originalEvent = event.data.event as
        | {
            data?: {
              projectId?: string;
            };
          }
        | undefined;

      const projectId = originalEvent?.data?.projectId;

      if (!projectId) {
        console.error(
          "setup-workflow onFailure: could not determine projectId from failure event.",
          event
        );

        return;
      }

      emitAgentStatus(
        projectId,
        "setup",
        "error",
        error?.message ?? "Setup failed after all retries.",
      );

      await prisma.project.update({
        where: {
          id: projectId,
        },
        data: {
          setupStatus: "FAILED",
          setupError:
            error?.message ?? "Setup failed after all retries.",
        },
      });
    },
  },

  async ({ event, step }) => {
    const {
      projectId,
      prompt,
      setupContext,
    } = event.data as {
      projectId: string;
      prompt: string;
      setupContext: SetupContext;
    };

    await step.run("mark-in-progress", async () => {
      const existing = await prisma.project.findUnique({
        where: {
          id: projectId,
        },
        select: {
          setupAttempts: true,
        },
      });

      await prisma.project.update({
        where: {
          id: projectId,
        },
        data: {
          setupStatus: "IN_PROGRESS",
          setupError: null,

          ...(existing?.setupAttempts === null
            ? {
                setupAttempts: 0,
              }
            : {}),
        },
      });
    });

    emitAgentStatus(projectId, "setup", "setup:starting", "Setting up your project…");

    const result = await step.run(
      "setup-project",
      async (): Promise<SetupResult> => {
        console.log(
          `Starting setup workflow for project ${projectId}`
        );

        try {
          const {
            session,
            isRecovery,
            recoveryObservation,
          } = await getOrRecreateSession(projectId);

          if (isRecovery) {
            emitAgentStatus(
              projectId,
              "setup",
              "setup:recovering",
              "Recovering previous session…",
            );
          }

          console.log(
            "Current sessions:",
            [...sessions.keys()]
          );

          async function nextAction(
            observation?: string
          ): Promise<AgentAction> {
            try {
              return await setupAgent({
                projectId,
                prompt,
                setupContext,
                observation,
              });
            } catch (err) {
              if (err instanceof AgentActionParseError) {
                throw new NonRetriableError(
                  `Agent returned an unrecognisable action: ${err.message}`
                );
              }

              throw err;
            }
          }

          let action = await nextAction(
            isRecovery
              ? recoveryObservation
              : undefined
          );

          let iterations = 0;

          let lastExecutedCommand:
            | string
            | undefined;

          let verifiedDevCommand:
            | string
            | undefined;

          while (action.tool !== "finish") {
            iterations++;

            if (iterations > MAX_ITERATIONS) {
              throw new Error(
                `Setup agent exceeded ${MAX_ITERATIONS} iterations without finishing. Aborting.`
              );
            }

            if (action.tool === "executeCommand") {
              console.log(
                "===== EXECUTE COMMAND ====="
              );

              console.log(action.command);

              console.log(
                "============================"
              );

              emitAgentStatus(
                projectId,
                "setup",
                "setup:command",
                action.command,
              );

              lastExecutedCommand = action.command;

              executeCommand(
                session,
                action.command
              );

              const evt = await nextEvent(session);

              if (evt.kind === "previewReady") {
                emitAgentStatus(
                  projectId,
                  "setup",
                  "setup:verifying",
                  "Preview verified.",
                );

                verifiedDevCommand =
                  lastExecutedCommand;
              }

              action = await nextAction(
                observationFromEvent(evt)
              );

              continue;
            }

            if (action.tool === "sendInput") {
              console.log(
                "===== SEND INPUT ====="
              );

              console.log(
                "Input:",
                JSON.stringify(action.input)
              );

              console.log(
                "======================="
              );

              emitAgentStatus(
                projectId,
                "setup",
                "setup:input",
                `Sending input: ${JSON.stringify(action.input)}`,
              );

              sendInput(
                session,
                action.input
              );

              const evt = await nextEvent(session);

              action = await nextAction(
                observationFromEvent(evt)
              );

              continue;
            }

            throw new Error(
              `Unknown agent action: ${JSON.stringify(action)}`
            );
          }

          console.log(
            "===== SETUP FINISHED ====="
          );

          console.log(action.reason);

          const previewReady =
            session.preview.state === "READY";

          if (!previewReady) {
            throw new Error(
              "Agent finished setup without a verified preview."
            );
          }

          emitAgentStatus(projectId, "setup", "setup:done", action.reason);

          return {
            success: true,
            reason: action.reason,
            previewReady: true,

            ...(session.preview.hostPort !== undefined && {
              hostPort: session.preview.hostPort,
            }),

            ...(verifiedDevCommand !== undefined && {
              devCommand: verifiedDevCommand,
            }),
          };
        } catch (err) {
          emitAgentStatus(
            projectId,
            "setup",
            "error",
            err instanceof Error ? err.message : String(err),
          );
          throw err;
        }
      }
    );

    await step.run(
      "record-setup-outcome",
      async () => {
        await prisma.project.update({
          where: {
            id: projectId,
          },
          data: {
            setupStatus: result.previewReady
              ? "READY"
              : "FAILED",

            setupError: result.previewReady
              ? null
              : "Agent finished setup without a verified preview.",
          },
        });
      }
    );

    await step.sendEvent(
      "handoff-to-coding",
      codingRequested.create({
        projectId,
        prompt,
        setupContext,
        isFollowUp: false,

        setupResult: {
          previewReady: result.previewReady,

          ...(result.hostPort !== undefined && {
            hostPort: result.hostPort,
          }),

          ...(result.devCommand !== undefined && {
            devCommand: result.devCommand,
          }),

          reason: result.reason,
        },
      })
    );

    return result;
  }
);