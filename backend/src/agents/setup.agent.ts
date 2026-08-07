



export type SetupRequest = {
  projectId: string;
  prompt: string;
};

export type SetupPlan = {
  framework: string;
  commands: string[];
};

export async function setupAgent(
  data: SetupRequest
): Promise<SetupPlan> {
  console.log("Setup Agent Started");
  console.log(data);

  return {
    framework: "react",
    commands: [
      "npm create vite@latest . -- --template react-ts",
      "npm install",
      "npm run dev -- --host 0.0.0.0",
    ],
  };
}