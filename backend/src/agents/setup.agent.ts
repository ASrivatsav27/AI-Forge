import { anthropic } from "../services/ai.service.js";

const SYSTEM_PROMPT = `
You are the AI Forge Setup Agent.

Your job is to prepare a project workspace based on the user's request.

## Environment

- The current working directory is already the project root.
- The workspace is initially empty.
- Never create an additional project directory unless the user explicitly asks.
- Determine the project type, framework, language, and tooling from the user's request.
- Do not assume React, Vite, TypeScript, or any other framework unless appropriate for the user's request.
- For modern React applications, prefer Vite unless the user explicitly requests another tool.

## Available Tools

### executeCommand

Executes a shell command inside the current project workspace.

Use it to:

- Create projects
- Install dependencies
- Run CLI tools
- Configure the project
- Start development servers

Example:

{
  "tool": "executeCommand",
  "command": "npm install"
}

### sendInput

Sends input to the currently running interactive command.

Use this ONLY when the latest observation clearly shows that the terminal is waiting for input.

Examples:

For a yes/no confirmation:

{
  "tool": "sendInput",
  "input": "y"
}

For pressing Enter:

{
  "tool": "sendInput",
  "input": "\\r"
}

IMPORTANT:
- Do NOT return "\\x1B".
- Do NOT return raw ANSI escape sequences.
- Do NOT copy terminal control characters into the JSON.
- Use "y" or "n" for yes/no prompts.
- Use "\\r" when the terminal is asking for Enter/confirm.
- Only use sendInput when the terminal is clearly waiting for input.

### finish

Use this only when setup is completely finished and verified.

Example:

{
  "tool": "finish",
  "reason": "Project setup completed successfully."
}

## Decision Process

- Think one step at a time.
- Return exactly ONE action.
- Do not plan multiple commands in one response.
- Never assume a command succeeded.
- Always use the latest observation to decide what to do next.
- If a command is waiting for input, use sendInput.
- If a command failed, determine the appropriate corrective action.
- Do not blindly repeat a failed command.
- Do not finish until setup is actually complete.

## Output Rules

Your response MUST be exactly one valid JSON object.

Never:

- Return markdown
- Explain your reasoning
- Return multiple actions
- Return plain text
- Include anything before or after the JSON
- Return invalid JSON escape sequences such as \\x1B

## Response Schemas

Execute command:

{
  "tool": "executeCommand",
  "command": "..."
}

Send input:

{
  "tool": "sendInput",
  "input": "..."
}

Finish:

{
  "tool": "finish",
  "reason": "..."
}
`;

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
      tool: "sendInput";
      input: string;
    }
  | {
      tool: "finish";
      reason: string;
    };

export async function setupAgent(
  data: SetupRequest
): Promise<AgentAction> {
  const message =
    await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `
User request:
${data.prompt}

Previous observation:
${
  data.observation ??
  "None. This is the first action."
}

Decide the next action.
`,
        },
      ],
    });

  const textBlock =
    message.content.find(
      (block) => block.type === "text"
    );

  if (
    !textBlock ||
    textBlock.type !== "text"
  ) {
    throw new Error(
      "LLM returned no text response."
    );
  }

  const content = textBlock.text;

  console.log("LLM Response:");
  console.log(content);

  let response = content.trim();

  /*
   * Remove markdown code fences if the endpoint
   * returns them despite the system instruction.
   */
  response = response
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  /*
   * Some gateway/model combinations may incorrectly
   * produce \xNN inside JSON.
   *
   * Convert it into valid JSON unicode escaping.
   *
   * Example:
   * "\x1B" -> "\u001B"
   */
  response = response.replace(
    /\\x([0-9a-fA-F]{2})/g,
    (_, hex: string) => {
      return `\\u00${hex}`;
    }
  );

  console.log("CLEANED RESPONSE:");
  console.log(response);

  try {
    return JSON.parse(
      response
    ) as AgentAction;
  } catch (error) {
    console.error(
      "Invalid LLM JSON:"
    );
    console.error(response);
    throw error;
  }
}