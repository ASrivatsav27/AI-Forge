import { inngest } from "../config/inngest.js";
import { setupAgent } from "../agents/setup.agent.js";
import { sessions } from "../session/session.manager.js";


export const setupWorkflow = inngest.createFunction(
  {
    id: "setup-workflow",
    triggers: [{ event: "project/setup.requested" }],
  },
  async ({ event, step }) => {
    await step.run("log-start", async () => {
      const { projectId } = event.data
      
      const session =  sessions.get(projectId)
      
      if (!session) {
        throw new Error("Session not found")
      }
     
     session.pty.write("echo 'Hello from Inngest'\n")
  
      console.log("Setup workflow started");
      console.log("Received event:", event.data);
    });

    return { success: true };
  }
);

