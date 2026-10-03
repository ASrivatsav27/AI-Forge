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
        "Use this to scaffold, install dependencies, configure frontend CORS/origin, or start the dev server.",
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
      name: "readFile",
      description:
        "Read an existing frontend configuration file from the project workspace.",
      parameters: {
        type: "object",
        properties: {
          relativePath: {
            type: "string",
            description: "Workspace-relative path of the file to read.",
          },
        },
        required: ["relativePath"],
        additionalProperties: false,
      },
    },
  },

  {
    type: "function",
    function: {
      name: "writeFile",
      description:
        "Write an existing frontend configuration file in the project workspace. Preserve all unrelated content.",
      parameters: {
        type: "object",
        properties: {
          relativePath: {
            type: "string",
            description: "Workspace-relative path of the file to write.",
          },
          content: {
            type: "string",
            description: "Complete updated file content.",
          },
        },
        required: ["relativePath", "content"],
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

Every decision must use the latest runtime observation AND the list of
actions you have already taken (provided in every turn).

Never assume a command succeeded.
Never assume a file exists.
Never assume dependencies are installed.
Never assume a server is running.
Never assume preview is verified.

Never repeat an action that already appears in your list of actions taken
and succeeded. Do not run "ls -la" again just to re-check a file you have
already seen or read. Move on to the next step of the sequence.

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

The setupContext/setupPrompt tells you what stack the user selected.

Backend and database selections are INFORMATION ONLY.

Do not configure them.

Your job is only to prepare the selected frontend.

---

## CORS / PREVIEW ORIGIN CONFIGURATION

Before starting the development server, configure the frontend development
server's CORS / allowed-origin / origin setting for:

  *.preview.adapasrivatsav.in

The selected framework is already provided in setupContext/setupPrompt.

Use that framework's appropriate configuration mechanism.

Do NOT add a generic CORS system.
Do NOT create a new configuration system.
Do NOT modify unrelated files.

Find the existing development-server configuration and make the smallest
possible change required to allow:

  *.preview.adapasrivatsav.in

Preserve all existing configuration and options.

THE EXACT OPTION TO SET (this is a dev-server option, NOT HTTP headers):

- Next.js: add the option allowedDevOrigins to the object in next.config.ts
  (or next.config.mjs / next.config.js), like this:

    allowedDevOrigins: ["*.preview.adapasrivatsav.in"],

- React/Vite: add the option allowedHosts inside the server object in
  frontend/vite.config.ts, like this:

    server: { allowedHosts: [".preview.adapasrivatsav.in"] },

NEVER add a headers() function, Access-Control-* headers, rewrites,
middleware, or any other CORS mechanism. They do not solve this problem.

Keep the file short. Copy the existing content exactly, add only the single
option above, and do not add comments or any other options.

For this CORS/origin step you MUST use ONLY readFile and writeFile.

NEVER use executeCommand to edit the configuration.

Do NOT use cat >, heredocs, echo >, sed, awk, perl, or shell redirection
to modify the configuration.

First use readFile to read the existing configuration.

Then use writeFile with the complete updated file content.

Preserve all existing configuration and make only the required
preview-origin change.

If the origin is already configured, do not write the file; just verify it.

SEQUENCE FOR THIS STEP (follow it using your list of actions taken):

1. readFile the configuration file (only once).
2. If the latest observation shows the file content and it does NOT already
   contain the preview origin, your NEXT action MUST be writeFile with the
   complete updated content. Do NOT run ls -la or readFile again first.
3. After writeFile succeeds, do exactly one readFile of the same file to
   verify it now contains the preview origin.
4. Once verified, start the development server.

If your list of actions taken already contains a successful readFile of the
configuration file, you must NOT read it again before writing it.

After editing, verify that the configuration actually contains the required
preview origin.

If the configuration already allows the preview origin, do not change it;
just verify it.

This CORS/origin configuration step must happen BEFORE starting the
development server.

After it is configured and verified, continue with the existing development
server command normally.

Do not make any other setup changes for this step.

---

## REACT / VITE

When framework is React:

If frontend does not exist:

  npm create vite@latest frontend -- --template react-ts --no-interactive

Wait for the command to finish.

Then:

  cd frontend && npm install

Wait for installation to finish.

Then configure and verify the CORS / preview origin as described above.

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

Configure and verify the CORS / preview origin as described above.

Then:

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

Use exactly one of:

executeCommand
readFile
writeFile
sendInput
finish

based on the latest observation.

---

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
  → configure and verify frontend CORS/origin
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
  setupPrompt?: string;
};

export type SetupRequest = {
  projectId: string;

  /** The user's application requirements — NOT read by the Setup Agent.
   * Kept here only so the workflow can forward it to the Coding workflow. */
  prompt: string;

  setupContext: SetupContext;
  observation?: string | undefined;

  /** Actions already taken in this setup run (oldest first). The agent has
   * no memory between turns, so this is what lets it know where it is. */
  history?: string[] | undefined;
};

export type AgentAction =
  | { tool: "executeCommand"; command: string }
  | { tool: "readFile"; relativePath: string }
  | { tool: "writeFile"; relativePath: string; content: string }
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

/**
 * The model is told to send "\\r" for Enter, but it often returns the literal
 * two characters backslash + r (or backslash + n) instead of a real Enter,
 * which then gets typed into the prompt as text. Convert those to an empty
 * string: sendInput() appends its own newline, which is the Enter keypress.
 * Ctrl-C variants are left alone because sendInput() already handles them.
 */
function normalizeKeystroke(raw: string): string {
  const t = raw.trim();

  if (
    t === "\\r" ||
    t === "\\n" ||
    t === "\\\\r" ||
    t === "\\\\n" ||
    t === "\r" ||
    t === "\n"
  ) {
    return "";
  }

  return raw;
}

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
    case "readFile": {
      if (typeof input.relativePath !== "string") {
        throw new AgentActionParseError(
          `readFile: expected input.relativePath to be a string, got ${typeof input.relativePath}`,
          block,
        );
      }

      return {
        tool: "readFile",
        relativePath: input.relativePath,
      };
    }

    case "writeFile": {
      if (typeof input.relativePath !== "string") {
        throw new AgentActionParseError(
          `writeFile: expected input.relativePath to be a string, got ${typeof input.relativePath}`,
          block,
        );
      }

      if (typeof input.content !== "string") {
        throw new AgentActionParseError(
          `writeFile: expected input.content to be a string, got ${typeof input.content}`,
          block,
        );
      }

      return {
        tool: "writeFile",
        relativePath: input.relativePath,
        content: input.content,
      };
    }

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
        input: normalizeKeystroke(input.input),
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

    max_tokens: 4096,

    temperature: 0,

    messages: [
      {
        role: "system",
        content: SYSTEM_PROMPT,
      },
      {
        role: "user",
        // NOTE: the Setup Agent reads setupContext.setupPrompt, NOT data.prompt.
        // data.prompt contains the user's application requirements and is
        // intentionally excluded here — it belongs to the Coding Agent only.
        content: `Setup instructions: ${data.setupContext.setupPrompt ?? "Follow the system prompt rules for the selected framework."}

Selected environment:

Framework: ${data.setupContext.framework}
Backend: ${data.setupContext.backend ?? "None"}
Database: ${data.setupContext.database ?? "None"}
Architecture: ${data.setupContext.architecture ?? "None"}
Connection string: ${
          data.setupContext.connectionString
            ? "Provided"
            : "Not provided"
        }

Actions you have already taken (oldest first):

${
  data.history && data.history.length > 0
    ? data.history.map((h, i) => `${i + 1}. ${h}`).join("\n")
    : "None"
}

Latest observation:

${data.observation ?? "None. This is the first action."}

Decide the next action.`,
      },
    ],

    tools: AGENT_TOOLS,

    tool_choice: "required",
  });

  if (message.choices[0]?.finish_reason === "length") {
    throw new AgentActionParseError(
      "Model output was truncated (hit max_tokens); refusing to act on a partial tool call.",
      message,
    );
  }

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
