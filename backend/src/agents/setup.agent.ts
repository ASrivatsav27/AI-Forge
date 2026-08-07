



export type SetupRequest = {
  projectId: string;
  prompt: string;
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
  console.log("Setup Agent Started");
  console.log(data);

  
  return {
    tool: "executeCommand",
    command: "echo 'Hello Agent'"
  };
}