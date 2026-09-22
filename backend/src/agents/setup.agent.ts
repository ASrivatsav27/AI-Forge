import OpenAI from "openai";
import { groq } from "../services/ai.service.js";
// ─── Tool definitions ──────────────────────────────────────────────────────────

const AGENT_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "executeCommand",
      description:
        "Execute a single shell command in the project workspace. " +
        "Use this to scaffold, install dependencies, or start the dev server.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The shell command to run.",
          },
        },
        required: ["command"],
        additionalProperties: false,
      },
    },
  },

  {
    type: "function",
    function: {
      name: "sendInput",
      description:
        'Send input to the currently running interactive process. ' +
        'Use special values: "\\r" for Enter, "\\u0003" for Ctrl-C.',
      parameters: {
        type: "object",
        properties: {
          input: {
            type: "string",
            description: "The input string to send to the process.",
          },
        },
        required: ["input"],
        additionalProperties: false,
      },
    },
  },

  {
    type: "function",
    function: {
      name: "finish",
      description:
        "Signal that setup is complete. Call this ONLY after the runtime " +
        "has confirmed the preview is verified and reachable.",
      parameters: {
        type: "object",
        properties: {
          reason: {
            type: "string",
            description: "A short explanation of why setup is now complete.",
          },
        },
        required: ["reason"],
        additionalProperties: false,
      },
    },
  },
];

// ─── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `
You are the AI Forge Setup Agent.

Your ONLY responsibility is preparing the FRONTEND development environment.

You do NOT:
- implement the user's application
- create backend code
- create Express
- configure databases
- create APIs
- create controllers/models/routes
- implement business logic
- implement application features

The Coding Agent handles all of those after setup finishes.

---

## OPERATING MODEL

You are called repeatedly:

observation
→ choose ONE action
→ runtime executes it
→ new observation
→ choose ONE action
→ ...

Every decision must use the latest runtime observation.

Never assume a command succeeded.
Never assume a file exists.
Never assume dependencies are installed.
Never assume a server is running.
Never assume preview is verified.

---

## PROJECT ROOT

The current working directory is already the project root.

Never create an additional outer project directory.

For React/Vite:

  workspace/
    frontend/

For Next.js:

  workspace/
    package.json
    app/
    ...

---

## SETUP RESPONSIBILITY

The setupContext tells you what stack the user selected.

Backend and database selections are INFORMATION ONLY.

Do not configure them.

Your job is only to prepare the selected frontend.

---

## REACT / VITE

When framework is React:

If frontend does not exist:

  npm create vite@latest frontend -- --template react-ts --no-interactive

Wait for the command to finish.

Then:

  cd frontend && npm install

Wait for installation to finish.

Then:

  cd frontend && npm run dev -- --host 0.0.0.0

Wait for preview verification.

Do NOT send Ctrl-C merely because installation takes time.

Do NOT treat npm install as a development server.

Do NOT start another server if one is already running.

---

## NEXT.JS

When framework is Next.js:

The Next.js project belongs at the workspace root.

If the project does not already exist:

  npx create-next-app@latest . --typescript --tailwind --eslint --app --no-src-dir --import-alias '@/*'

Allow creation and dependency installation to finish.

Do NOT send Ctrl-C merely because preview is absent during installation.

After the command finishes:

  npm run dev -- --hostname 0.0.0.0

Wait for preview verification.

Do not use Vite flags for Next.js.

Do not create a separate frontend directory for Next.js.

---

## COMMANDS VS DEVELOPMENT SERVERS

Setup/install commands include:

- npm create vite@latest
- npx create-next-app@latest
- npm install
- npm ci
- pnpm install
- yarn install

These must be allowed to finish.

Do NOT send Ctrl-C because preview has not appeared yet.

Development server commands include:

- npm run dev
- npm start
- vite --host 0.0.0.0
- next dev
- npm run dev -- --hostname 0.0.0.0

These are long-running processes.

Do NOT send Ctrl-C just because the process remains running.

---

## INTERACTIVE INPUT

Use sendInput ONLY when the latest observation clearly shows
an interactive prompt or when an existing development server must be stopped.

For Enter use:

  "\\r"

For Ctrl-C use:

  "\\u0003"

Never guess an interactive prompt.

Never send Ctrl-C during npm install or project creation merely because
preview is not available.

---

## PREVIEW

AI Forge separately reports preview state.

If the observation says:

  Preview verification:
  Status: READY
  HTTP preview check: PASSED

then the frontend is verified.

Do NOT start another server.

Call finish.

If preview is still starting:

- do nothing
- do not restart the server
- wait for the next observation

If preview fails:

- inspect the actual error
- make the smallest required fix
- restart only if necessary

---

## FINISH

Call finish ONLY when:

1. Frontend setup is complete.
2. Required frontend dependencies are installed.
3. Frontend development server is running.
4. AI Forge explicitly confirms preview is READY/reachable.

finish means:

"Frontend setup is complete and ready for the Coding Agent."

It does NOT mean the application itself is complete.

The Coding Agent will implement the application after handoff.

---

## ONE ACTION PER TURN

Every response MUST choose exactly ONE tool action.

Never return multiple actions.
Never return a plan instead of an action.
Never return markdown.
Never explain your reasoning.

Return exactly one valid tool call.

Use:

executeCommand

sendInput

or:

finish

based on the latest observation.


## BACKEND IS NEVER YOUR JOB

Even when setupContext contains:

  backend = "Express"

or:

  database = "PostgreSQL"

or:

  database = "MongoDB"

you MUST NOT act on those selections.

They are passed to you only so you understand the final environment.

For React + Express, your entire job is:

  create/prepare frontend/
  → install frontend dependencies
  → start frontend
  → get frontend preview verified
  → finish

You MUST NOT create backend/ under any circumstance.

You MUST NOT run npm install for Express.

You MUST NOT create server.ts, app.ts, routes, controllers, models,
middleware, database configuration, API endpoints, or backend package.json.

The Coding Agent creates all backend and database functionality after you finish.
`;

// ─── Types ─────────────────────────────────────────────────────────────────────

export type SetupContext = {
  framework: string;
  backend?: string;
  database?: string;
  architecture?: string;
  connectionString?: string;
};

export type SetupRequest = {
  projectId: string;
  prompt: string;
  setupContext: SetupContext;
  observation?: string | undefined;
};

export type AgentAction =
  | { tool: "executeCommand"; command: string }
  | { tool: "sendInput"; input: string }
  | { tool: "finish"; reason: string };

// ─── Errors ────────────────────────────────────────────────────────────────────

export class AgentActionParseError extends Error {
  constructor(
    message: string,
    public readonly raw: unknown,
  ) {
    super(message);
    this.name = "AgentActionParseError";
  }
}

// ─── Validation ────────────────────────────────────────────────────────────────

type GroqToolCall =
  OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall;

function parseToolCall(
  block: GroqToolCall,
): AgentAction {
  let input: Record<string, unknown>;

  try {
    input = JSON.parse(block.function.arguments);
  } catch {
    throw new AgentActionParseError(
      `Invalid JSON arguments returned for tool "${block.function.name}".`,
      block,
    );
  }

  switch (block.function.name) {
    case "executeCommand": {
      if (typeof input.command !== "string") {
        throw new AgentActionParseError(
          `executeCommand: expected input.command to be a string, got ${typeof input.command}`,
          block,
        );
      }

      return {
        tool: "executeCommand",
        command: input.command,
      };
    }

    case "sendInput": {
      if (typeof input.input !== "string") {
        throw new AgentActionParseError(
          `sendInput: expected input.input to be a string, got ${typeof input.input}`,
          block,
        );
      }

      return {
        tool: "sendInput",
        input: input.input,
      };
    }

    case "finish": {
      if (typeof input.reason !== "string") {
        throw new AgentActionParseError(
          `finish: expected input.reason to be a string, got ${typeof input.reason}`,
          block,
        );
      }

      return {
        tool: "finish",
        reason: input.reason,
      };
    }

    default: {
      throw new AgentActionParseError(
        `Unknown tool name returned by model: "${block.function.name}"`,
        block,
      );
    }
  }
}

// ─── Agent ─────────────────────────────────────────────────────────────────────

export async function setupAgent(
  data: SetupRequest,
): Promise<AgentAction> {
  const message = await groq.chat.completions.create({
    model: "qwen/qwen3.8-27b",

    max_tokens:512,

    temperature: 0,

    messages: [
      {
        role: "system",
        content: SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: `User request: ${data.prompt}

Selected setup environment:

Framework: ${data.setupContext.framework}
Backend: ${data.setupContext.backend ?? "None"}
Database: ${data.setupContext.database ?? "None"}
Architecture: ${data.setupContext.architecture ?? "None"}
Connection string: ${
          data.setupContext.connectionString
            ? "Provided"
            : "Not provided"
        }

Latest observation:

${data.observation ?? "None. This is the first action."}

Decide the next action.`,
      },
    ],

    tools: AGENT_TOOLS,

    tool_choice: "required",
  });

  const assistantMessage =
    message.choices[0]?.message;

  if (!assistantMessage) {
    throw new AgentActionParseError(
      "No assistant message found in model response.",
      message,
    );
  }

  const toolCalls =
    assistantMessage.tool_calls;

  if (!toolCalls || toolCalls.length === 0) {
    throw new AgentActionParseError(
      "No tool call found in model response.",
      assistantMessage,
    );
  }

  if (toolCalls.length !== 1) {
    throw new AgentActionParseError(
      `Expected exactly one tool call, received ${toolCalls.length}.`,
      toolCalls,
    );
  }

  const toolCall = toolCalls[0]!;

  if (toolCall.type !== "function") {
    throw new AgentActionParseError(
      "Setup Agent returned a non-function tool call.",
      toolCall,
    );
  }

  console.log(
    "Agent action:",
    toolCall.function.name,
    toolCall.function.arguments,
  );

  return parseToolCall(toolCall);
}