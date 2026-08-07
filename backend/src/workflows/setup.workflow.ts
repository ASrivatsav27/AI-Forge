import { inngest } from "../config/inngest.js";

export const setupWorkflow = inngest.createFunction(
  {
    id: "setup-workflow",
    triggers: [{ event: "project/setup.requested" }],
  },
  async ({ event, step }) => {
    await step.run("log-start", async () => {
      console.log("Setup workflow started");
      console.log("Received event:", event.data);
    });

    return { success: true };
  }
);