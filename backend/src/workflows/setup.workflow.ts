import { inngest } from "../config/inngest.js";
import { setupAgent } from "../agents/setup.agent.js";
import { sessions } from "../session/session.manager.js";
import {
  executeCommand,
  sendInput,
  waitForCommandResult,
} from "../services/executeCommand.js";

export const setupWorkflow = inngest.createFunction(
  {
    id: "setup-workflow",
    triggers: [
      {
        event: "project/setup.requested",
      },
    ],
  },

  async ({ event, step }) => {
    await step.run("setup-project", async () => {
      const { projectId, prompt } = event.data;

      console.log(
        `Starting setup workflow for project ${projectId}`
      );

      const session = sessions.get(projectId);

      console.log(
        "Current sessions:",
        [...sessions.keys()]
      );

      if (!session) {
        throw new Error("Session not found");
      }

      let action = await setupAgent({
        projectId,
        prompt,
      });

      while (action.tool !== "finish") {
        switch (action.tool) {
          case "executeCommand": {
            console.log(
              "===== EXECUTE COMMAND ====="
            );

            console.log(action.command);

            console.log(
              "==========================="
            );

            const result = await executeCommand(
              session,
              action.command
            );

            console.log(
              "===== OBSERVATION ====="
            );

            console.log(result.stdout);

            console.log(
              "======================="
            );

            action = await setupAgent({
              projectId,
              prompt,
              observation: result.stdout,
            });

            break;
          }

          case "sendInput": {
            console.log(
              "===== SEND INPUT ====="
            );

            console.log(
              "Input:",
              action.input
            );

            console.log(
              "======================"
            );

            // Send input to the SAME running PTY.
            sendInput(
              session,
              action.input
            );

            console.log(
              "Input sent. Waiting for command to finish..."
            );

            // Wait for the command that was already
            // running when the prompt appeared.
            const result =
              await waitForCommandResult(
                session
              );

            console.log(
              "===== OBSERVATION ====="
            );

            console.log(result.stdout);

            console.log(
              "Success:",
              result.success
            );

            console.log(
              "======================="
            );

            // Give the completed command output
            // back to the agent.
            action = await setupAgent({
              projectId,
              prompt,
              observation: result.stdout,
            });

            break;
          }

          default: {
            throw new Error(
              `Unknown agent action: ${JSON.stringify(
                action
              )}`
            );
          }
        }
      }

      console.log(
        "===== SETUP FINISHED ====="
      );

      console.log(
        action.reason
      );
    });

    return {
      success: true,
    };
  }
);