import { inngest } from "../config/inngest.js";
import { setupAgent } from "../agents/setup.agent.js";
import { sessions } from "../session/session.manager.js";
import { executeCommand } from "../services/executeCommand.js";

export const setupWorkflow = inngest.createFunction(
  {
    id: "setup-workflow",
    triggers: [{ event: "project/setup.requested" }],
  },
  async ({ event, step }) => {
    await step.run("log-start", async () => {
      const { projectId, prompt } = event.data;

      console.log(`Starting setup workflow for project ${projectId}`);

      const session = sessions.get(projectId);

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
            const result = await executeCommand(session, action.command);

            action = await setupAgent({
              projectId,
              prompt,
              observation: result.stdout,
            });

            break;
          }
        }
      }

      console.log(action.reason);
    });

    return { success: true };
  }
);