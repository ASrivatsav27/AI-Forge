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
      const { projectId } = event.data
      console.log(`Starting setup workflow for project ${projectId}`);
      const session =  sessions.get(projectId)
      
      if (!session) {
        throw new Error("Session not found")
      }
  
      const action = await setupAgent({
       projectId,prompt:event.data.prompt,
      })
   
      switch (action.tool) {
        case "executeCommand": {
          const result = await executeCommand(session, action.command)

          break
      }
      case "finish":
      console.log(action.reason);
      break;
    }

 
    });

    return { success: true };
  }
);

