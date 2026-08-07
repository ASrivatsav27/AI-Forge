



export type SetupRequest = {
  projectId: string;
  prompt: string;
  observation?: string;
};

export type AgentAction =
  | {
      tool: "executeCommand";
      command: string;
    }
  | {
      tool: "finish";
      reason: string;
    };

export async function setupAgent(
  data: SetupRequest
): Promise<AgentAction> {
    
  console.log("Prompt:", data.prompt);

  if (!data.observation) {
    console.log("Observation:", data.observation);
  }
  return {
    tool: "executeCommand",
    command: "echo 'Hello Agent'"
  };
}