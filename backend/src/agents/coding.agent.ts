import Anthropic from "@anthropic-ai/sdk";

import type { SetupContext } from "../types/inngest.types.js";

import { claude } from "../services/ai.service.js";

// ─────────────────────────────────────────────────────────────
// MODEL — Claude through your custom Anthropic-compatible gateway
// ─────────────────────────────────────────────────────────────

const MODEL = "claude-opus-4-8";

// ─────────────────────────────────────────────────────────────
// TYPES — execution plan
// ─────────────────────────────────────────────────────────────

export type FilePlan = {
  path: string;
  action: "create" | "modify";
  description: string;
  dependsOn: string[];
};

export type ExecutionPlan = {
  files: FilePlan[];
  setupCommands: string[];
  verifyCommand: string;
};

export type PlanRequest = {
  projectId: string;
  userPrompt: string;
  setupContext: SetupContext;
  setupOutput?: string;
  workspaceListing: string;
};

export type GenerateFileRequest = {
  file: FilePlan;
  userPrompt: string;
  setupContext: SetupContext;

  /** Full content of every file this one depends on — nothing else. */
  dependencyContents: Record<string, string>;

  /** If action is "modify", the file's current content. */
  existingContent?: string;
};

export type FixFileRequest = {
  file: FilePlan;
  currentContent: string;
  buildError: string;
};

// ─────────────────────────────────────────────────────────────
// ERRORS
// ─────────────────────────────────────────────────────────────

export class ModelResponseParseError extends Error {
  constructor(
    message: string,
    public readonly raw: unknown,
  ) {
    super(message);
    this.name = "ModelResponseParseError";
  }
}

export class DailyTokenLimitError extends Error {
  constructor(
    message: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "DailyTokenLimitError";
  }
}

// ─────────────────────────────────────────────────────────────
// RETRY HELPERS
// ─────────────────────────────────────────────────────────────

const MAX_TRANSIENT_RETRIES = 3;
const BASE_BACKOFF_MS = 3000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAPIError(err: unknown): err is {
  status: number;
  message?: string;
  headers?: Headers;
  error?: {
    code?: string;
    message?: string;
    type?: string;
  };
} {
  return (
    typeof err === "object" &&
    err !== null &&
    "status" in err
  );
}

// ─────────────────────────────────────────────────────────────
// ANTHROPIC RESPONSE HELPERS
// ─────────────────────────────────────────────────────────────

function extractTextContent(
  response: Anthropic.Message | undefined,
): string {
  if (!response) {
    throw new ModelResponseParseError(
      "No response from model.",
      response,
    );
  }

  const textBlocks = response.content.filter(
    (block): block is Anthropic.TextBlock =>
      block.type === "text",
  );

  if (textBlocks.length === 0) {
    throw new ModelResponseParseError(
      "No text content in model response.",
      response,
    );
  }

  return textBlocks.map((block) => block.text).join("");
}

// ─────────────────────────────────────────────────────────────
// MODEL CALL WITH RETRIES
// ─────────────────────────────────────────────────────────────

async function callModelWithRetry(
  client: Anthropic,
  params: Anthropic.MessageCreateParamsNonStreaming,
): Promise<Anthropic.Message> {
  let lastError: unknown;

  for (
    let attempt = 0;
    attempt <= MAX_TRANSIENT_RETRIES;
    attempt++
  ) {
    try {
      const response = await client.messages.create(params);

      return response;
    } catch (err) {
      lastError = err;

      if (!isAPIError(err)) {
        throw err;
      }

      const status = err.status;
      const errorMessage =
        err.error?.message ??
        err.message ??
        "Unknown API error";

      // ─────────────────────────────────────────────
      // DAILY TOKEN LIMIT
      // ─────────────────────────────────────────────

      if (
        status === 429 &&
        errorMessage.toLowerCase().includes("tokens per day")
      ) {
        const retryAfterHeader =
          err.headers?.get?.("retry-after");

        const retryAfterSeconds = retryAfterHeader
          ? Number(retryAfterHeader)
          : undefined;

        throw new DailyTokenLimitError(
          errorMessage,
          retryAfterSeconds,
        );
      }

      // ─────────────────────────────────────────────
      // RATE LIMIT
      // ─────────────────────────────────────────────

      if (status === 429) {
        if (attempt === MAX_TRANSIENT_RETRIES) {
          break;
        }

        const retryAfterHeader =
          err.headers?.get?.("retry-after");

        const waitSeconds = retryAfterHeader
          ? Number(retryAfterHeader)
          : (attempt + 1) * 5;

        console.log(
          `Rate limited — waiting ${waitSeconds}s before retry ${
            attempt + 1
          }/${MAX_TRANSIENT_RETRIES}`,
        );

        await sleep(waitSeconds * 1000);
        continue;
      }

      // ─────────────────────────────────────────────
      // TOOL USE FAILURE
      // ─────────────────────────────────────────────

      if (
        status === 400 &&
        err.error?.code === "tool_use_failed"
      ) {
        if (attempt === MAX_TRANSIENT_RETRIES) {
          break;
        }

        console.log(
          `tool_use_failed — retrying (${
            attempt + 1
          }/${MAX_TRANSIENT_RETRIES})`,
        );

        await sleep(BASE_BACKOFF_MS * (attempt + 1));
        continue;
      }

      // ─────────────────────────────────────────────
      // SERVER / UPSTREAM ERRORS
      // ─────────────────────────────────────────────

      if (status >= 500) {
        if (attempt === MAX_TRANSIENT_RETRIES) {
          break;
        }

        const backoff =
          BASE_BACKOFF_MS * (attempt + 1);

        console.log(
          `Upstream ${status} — retrying in ${backoff}ms ` +
            `(${attempt + 1}/${MAX_TRANSIENT_RETRIES})`,
        );

        await sleep(backoff);
        continue;
      }

      // ─────────────────────────────────────────────
      // OTHER ERRORS
      // ─────────────────────────────────────────────

      throw err;
    }
  }

  throw lastError;
}

// ─────────────────────────────────────────────────────────────
// JSON EXTRACTION HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Strips ```json / ```typescript / ```tsx etc.
 * that the model may wrap its output in.
 */
function stripCodeFences(text: string): string {
  const trimmed = text.trim();

  const fenced = trimmed.match(
    /^```(?:json|typescript|tsx|jsx|ts|js|css)?\s*\n([\s\S]*?)\n```$/,
  );

  return fenced ? fenced[1]! : trimmed;
}

function parseJSON<T>(
  text: string,
  context: string,
): T {
  try {
    return JSON.parse(
      stripCodeFences(text),
    ) as T;
  } catch (err) {
    throw new ModelResponseParseError(
      `Failed to parse JSON for ${context}: ${
        err instanceof Error
          ? err.message
          : String(err)
      }`,
      text,
    );
  }
}

// ─────────────────────────────────────────────────────────────
// PHASE 1: PLAN
// ─────────────────────────────────────────────────────────────

const PLAN_SYSTEM_PROMPT = `
You are the AI Forge Planning Agent.

Given a user's application request and the current workspace
listing, produce a complete file-level execution plan as JSON.

Respond with ONLY a JSON object, no prose, no code fences,
matching exactly:

{
  "files": [
    {
      "path": "relative/path.tsx",
      "action": "create" | "modify",
      "description": "what this file should contain, 1-2 sentences",
      "dependsOn": ["other/path.ts"]
    }
  ],
  "setupCommands": ["shell command", ...],
  "verifyCommand": "shell command to start the dev server for verification"
}

RULES:

1. "dependsOn" lists other file paths FROM THIS PLAN that must
   be generated first because this file imports from or reads them.
   Do not list files outside this plan.

2. Keep the dependency graph as shallow and wide as possible.
   Most files should have 0-1 dependencies.
   Do not create unnecessary chains.

3. Use the exact framework already present in the workspace.
   Do not substitute or re-scaffold what already exists.

4. "action": "modify" for files that already exist in the
   workspace listing and need changes.
   "create" for new files.

5. setupCommands should only include commands beyond what's
   already installed.
   Do not repeat framework installation.

6. verifyCommand — how to determine it:

   a. SETUP OUTPUT below was written by the agent that already
      got this exact project's dev server running and verified.
      If it states the literal command it used, copy that command
      verbatim into verifyCommand.

   b. If SETUP OUTPUT does not state the command it used,
      construct one yourself, but it MUST explicitly bind the
      dev server to all network interfaces, not just localhost.

      This project runs inside a container reachable only via its
      mapped port, so localhost/127.0.0.1 is insufficient.

      Determine the correct flag from the project's own tooling.
      Examples:
      --host 0.0.0.0
      --hostname 0.0.0.0

   c. Never emit a bare dev command such as:
      npm run dev

      unless you have verified that the underlying tooling already
      binds to all interfaces.

7. Do not include lockfiles, node_modules, or build output
   directories in "files".

8. Keep the plan minimal and sufficient.
   Every file must be necessary for the request.
   Do not add speculative files.
`;

export async function planProject(
  data: PlanRequest,
): Promise<ExecutionPlan> {
  const userContent = `
SETUP CONTEXT

${JSON.stringify(data.setupContext, null, 2)}

---

SETUP OUTPUT

${data.setupOutput ?? "(No setup output provided.)"}

---

CURRENT WORKSPACE LISTING

${data.workspaceListing}

---

USER APPLICATION REQUEST

${data.userPrompt}

---

Produce the execution plan JSON now.
`;

  console.log("===== PLAN REQUEST =====");
  console.log(data.userPrompt);
  console.log("=========================");

  const response = await callModelWithRetry(
    claude,
    {
      model: MODEL,
      max_tokens: 4096,
      temperature: 0,
      system: PLAN_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: userContent,
        },
      ],
    },
  );

  const text = extractTextContent(response);

  const plan =
    parseJSON<ExecutionPlan>(
      text,
      "execution plan",
    );

  if (
    !Array.isArray(plan.files) ||
    plan.files.length === 0
  ) {
    throw new ModelResponseParseError(
      "Execution plan has no files.",
      plan,
    );
  }

  console.log("===== PLAN RESULT =====");
  console.log(
    `${plan.files.length} files, ${
      plan.setupCommands.length
    } setup commands`,
  );

  console.log(
    plan.files
      .map(
        (f) =>
          `  ${f.action} ${f.path} ` +
          `(deps: ${
            f.dependsOn.join(", ") || "none"
          })`,
      )
      .join("\n"),
  );

  console.log(
    `verifyCommand: ${plan.verifyCommand}`,
  );

  console.log("========================");

  return plan;
}

// ─────────────────────────────────────────────────────────────
// DEPENDENCY BATCHING
// ─────────────────────────────────────────────────────────────

export function buildDependencyBatches(
  files: FilePlan[],
): FilePlan[][] {
  const byPath = new Map(
    files.map((f) => [f.path, f]),
  );

  const remaining = new Set(
    files.map((f) => f.path),
  );

  const batches: FilePlan[][] = [];

  while (remaining.size > 0) {
    const batch: FilePlan[] = [];

    for (const path of remaining) {
      const file = byPath.get(path)!;

      const unmetDeps = file.dependsOn.filter(
        (d) =>
          remaining.has(d) &&
          byPath.has(d),
      );

      if (unmetDeps.length === 0) {
        batch.push(file);
      }
    }

    if (batch.length === 0) {
      console.log(
        `WARNING: dependency deadlock among [` +
          `${[...remaining].join(", ")}` +
          `] — flushing as one batch.`,
      );

      for (const path of remaining) {
        batch.push(byPath.get(path)!);
      }
    }

    for (const file of batch) {
      remaining.delete(file.path);
    }

    batches.push(batch);
  }

  return batches;
}

// ─────────────────────────────────────────────────────────────
// PHASE 2: GENERATE FILE CONTENT
// ─────────────────────────────────────────────────────────────

const GENERATE_SYSTEM_PROMPT = `
You are the AI Forge File Generation Agent.

You generate the complete content of ONE file at a time.

Respond with ONLY the raw file content.

No prose.
No explanation.
No markdown code fences.
No commentary before or after.

The entire response is written directly to disk as the file's
content.

RULES:

1. Use the dependency file contents provided to import correctly
   and stay consistent with existing types, exports, and styling
   conventions.

2. If modifying an existing file, preserve unrelated existing
   code and only change what the description requires.

3. Never hardcode credentials.
   Use environment variables where relevant.

4. Output must be complete and syntactically valid on its own.

5. Never use placeholders such as:
   "// rest of code here"
   "// TODO"
   "// implement this"
   or incomplete sections.
`;

function buildDependencySection(
  dependencyContents: Record<string, string>,
): string {
  const entries = Object.entries(
    dependencyContents,
  );

  if (entries.length === 0) {
    return (
      "(No dependencies — this file does not " +
      "import from other planned files.)"
    );
  }

  return entries
    .map(
      ([path, content]) =>
        `--- ${path} ---\n${content}`,
    )
    .join("\n\n");
}

export async function generateFileContent(
  req: GenerateFileRequest,
): Promise<string> {
  const userContent = `
SETUP CONTEXT

${JSON.stringify(req.setupContext, null, 2)}

---

USER APPLICATION REQUEST (overall context)

${req.userPrompt}

---

FILE TO GENERATE

Path: ${req.file.path}

Action: ${req.file.action}

Description: ${req.file.description}

---

DEPENDENCY FILE CONTENTS
(files this one depends on)

${buildDependencySection(
  req.dependencyContents,
)}

---

${
  req.existingContent
    ? `EXISTING CONTENT OF THIS FILE
(being modified — preserve unrelated code)

${req.existingContent}

---`
    : ""
}

Output the complete file content now.

No fences.
No prose.
No explanation.
Just the file content.
`;

  console.log(
    `===== GENERATE FILE: ${req.file.path} =====`,
  );

  const response =
    await callModelWithRetry(
      claude,
      {
        model: MODEL,
        max_tokens: 8192,
        temperature: 0,
        system: GENERATE_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: userContent,
          },
        ],
      },
    );

  const text =
    extractTextContent(response);

  const content =
    stripCodeFences(text);

  console.log(
    `Generated ${content.length} chars for ${req.file.path}`,
  );

  console.log(
    "=============================================",
  );

  return content;
}

// ─────────────────────────────────────────────────────────────
// PHASE 3: FIX FILE
// ─────────────────────────────────────────────────────────────

const FIX_SYSTEM_PROMPT = `
You are the AI Forge Fix Agent.

You are given one file's current content and a build/runtime
error.

Produce the corrected complete file content.

Respond with ONLY the raw corrected file content.

No prose.
No explanation.
No markdown code fences.

RULES:

1. Make the smallest change that resolves the reported error.
   Do not restructure unrelated code.

2. Do not introduce new dependencies unless the error explicitly
   requires it.

3. Output must be complete and syntactically valid on its own.

4. Never omit existing code.

5. Never use placeholders such as:
   "// rest of code here"
   "// TODO"
   "// unchanged code"
`;

export async function fixFile(
  req: FixFileRequest,
): Promise<string> {
  const userContent = `
FILE: ${req.file.path}

CURRENT CONTENT

${req.currentContent}

---

BUILD/RUNTIME ERROR

${req.buildError}

---

Output the corrected complete file content now.

No fences.
No prose.
No explanation.
`;

  console.log(
    `===== FIX FILE: ${req.file.path} =====`,
  );

  const response =
    await callModelWithRetry(
      claude,
      {
        model: MODEL,
        max_tokens: 8192,
        temperature: 0,
        system: FIX_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: userContent,
          },
        ],
      },
    );

  const text =
    extractTextContent(response);

  const content =
    stripCodeFences(text);

  console.log(
    `Fixed ${req.file.path}: ${content.length} chars`,
  );

  console.log(
    "========================================",
  );

  return content;
}

// ─────────────────────────────────────────────────────────────
// PHASE 4 SUPPORT: LOG PARSING
// ─────────────────────────────────────────────────────────────

/**
 * Extracts a file path from a Next.js build/runtime error.
 *
 * Example:
 *
 * "./components/Hero.tsx (330:51)"
 *
 * or:
 *
 * Server Component:
 *   ./components/Hero.tsx
 *   ./app/page.tsx
 *
 * Returns the FIRST known plan path found in the log.
 */
export function extractErrorFilePath(
  buildLog: string,
  knownPaths: string[],
): string | null {
  for (const knownPath of knownPaths) {
    const escaped =
      knownPath.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&",
      );

    const pattern = new RegExp(
      `(^|[\\s./])${escaped}([:(]|\\s|$)`,
      "m",
    );

    if (pattern.test(buildLog)) {
      return knownPath;
    }
  }

  return null;
}

/**
 * Detects:
 *
 * Module not found: Can't resolve 'X'
 *
 * and returns the missing package name.
 *
 * These are not fixable by editing a file's content —
 * they need an npm install.
 */
export function extractMissingPackage(
  buildLog: string,
): string | null {
  const match = buildLog.match(
    /Module not found:.*?Can't resolve ['"]([^'"./][^'"]*)['"]/i,
  );

  return match ? match[1]! : null;
}