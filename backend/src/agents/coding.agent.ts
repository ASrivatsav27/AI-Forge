import Anthropic from "@anthropic-ai/sdk";

import type { SetupContext, ImageInput } from "../types/inngest.types.js";
export type { ImageInput } from "../types/inngest.types.js";

import { claude } from "../services/ai.service.js";

// ─────────────────────────────────────────────────────────────
// MODEL
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
  image?: ImageInput;
};

export type GenerateFileRequest = {
  file: FilePlan;
  userPrompt: string;
  setupContext: SetupContext;
  dependencyContents: Record<string, string>;
  existingContent?: string;
  image?: ImageInput;
  onDelta?: (delta: string) => void;
};

export type FixFileRequest = {
  file: FilePlan;
  currentContent: string;
  buildError: string;
  onDelta?: (delta: string) => void;
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
  return typeof err === "object" && err !== null && "status" in err;
}

function isTransientNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const codes = ["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "EPIPE", "ENOTFOUND"];
  let current: unknown = err;
  for (let i = 0; i < 5 && current; i++) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string" && codes.includes(code)) return true;
    current = (current as { cause?: unknown }).cause;
  }
  if (err.name === "TypeError" && err.message === "terminated") return true;
  if (err.message.toLowerCase().includes("fetch failed")) return true;
  return false;
}

// ─────────────────────────────────────────────────────────────
// ANTHROPIC RESPONSE HELPERS
// ─────────────────────────────────────────────────────────────

function extractTextContent(response: Anthropic.Message | undefined): string {
  if (!response) throw new ModelResponseParseError("No response from model.", response);
  const textBlocks = response.content.filter((b): b is Anthropic.TextBlock => b.type === "text");
  if (textBlocks.length === 0) throw new ModelResponseParseError("No text content in model response.", response);
  return textBlocks.map((b) => b.text).join("");
}

function buildUserContent(
  text: string,
  image?: ImageInput,
): Anthropic.MessageCreateParamsNonStreaming["messages"][number]["content"] {
  if (!image) return text;
  return [
    { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } },
    { type: "text", text },
  ];
}

// ─────────────────────────────────────────────────────────────
// MODEL CALL WITH RETRIES
// ─────────────────────────────────────────────────────────────

async function callModelWithRetry(
  client: Anthropic,
  params: Anthropic.MessageCreateParamsNonStreaming,
): Promise<Anthropic.Message> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_TRANSIENT_RETRIES; attempt++) {
    try {
      return await client.messages.create(params);
    } catch (err) {
      lastError = err;
      if (isTransientNetworkError(err)) {
        if (attempt === MAX_TRANSIENT_RETRIES) break;
        const backoff = BASE_BACKOFF_MS * (attempt + 1);
        console.log(`Network error (${(err as Error).message}) — retrying in ${backoff}ms (${attempt + 1}/${MAX_TRANSIENT_RETRIES})`);
        await sleep(backoff);
        continue;
      }
      if (!isAPIError(err)) throw err;
      const status = err.status;
      const errorMessage = err.error?.message ?? err.message ?? "Unknown API error";
      if (status === 429 && errorMessage.toLowerCase().includes("tokens per day")) {
        const retryAfterHeader = err.headers?.get?.("retry-after");
        throw new DailyTokenLimitError(errorMessage, retryAfterHeader ? Number(retryAfterHeader) : undefined);
      }
      if (status === 429) {
        if (attempt === MAX_TRANSIENT_RETRIES) break;
        const retryAfterHeader = err.headers?.get?.("retry-after");
        const waitSeconds = retryAfterHeader ? Number(retryAfterHeader) : (attempt + 1) * 5;
        console.log(`Rate limited — waiting ${waitSeconds}s before retry ${attempt + 1}/${MAX_TRANSIENT_RETRIES}`);
        await sleep(waitSeconds * 1000);
        continue;
      }
      if (status === 400 && err.error?.code === "tool_use_failed") {
        if (attempt === MAX_TRANSIENT_RETRIES) break;
        console.log(`tool_use_failed — retrying (${attempt + 1}/${MAX_TRANSIENT_RETRIES})`);
        await sleep(BASE_BACKOFF_MS * (attempt + 1));
        continue;
      }
      if (status >= 500) {
        if (attempt === MAX_TRANSIENT_RETRIES) break;
        const backoff = BASE_BACKOFF_MS * (attempt + 1);
        console.log(`Upstream ${status} — retrying in ${backoff}ms (${attempt + 1}/${MAX_TRANSIENT_RETRIES})`);
        await sleep(backoff);
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

// ─────────────────────────────────────────────────────────────
// STREAMING MODEL CALL WITH RETRIES
// ─────────────────────────────────────────────────────────────

async function callModelStreamWithRetry(
  client: Anthropic,
  params: Anthropic.MessageCreateParamsNonStreaming,
  onDelta?: (delta: string) => void,
): Promise<Anthropic.Message> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_TRANSIENT_RETRIES; attempt++) {
    try {
      const stream = client.messages.stream(params);
      if (onDelta) stream.on("text", (delta) => onDelta(delta));
      return await stream.finalMessage();
    } catch (err) {
      lastError = err;
      if (isTransientNetworkError(err)) {
        if (attempt === MAX_TRANSIENT_RETRIES) break;
        const backoff = BASE_BACKOFF_MS * (attempt + 1);
        console.log(`Network error (stream) (${(err as Error).message}) — retrying in ${backoff}ms (${attempt + 1}/${MAX_TRANSIENT_RETRIES})`);
        await sleep(backoff);
        continue;
      }
      if (!isAPIError(err)) throw err;
      const status = err.status;
      const errorMessage = err.error?.message ?? err.message ?? "Unknown API error";
      if (status === 429 && errorMessage.toLowerCase().includes("tokens per day")) {
        const retryAfterHeader = err.headers?.get?.("retry-after");
        throw new DailyTokenLimitError(errorMessage, retryAfterHeader ? Number(retryAfterHeader) : undefined);
      }
      if (status === 429) {
        if (attempt === MAX_TRANSIENT_RETRIES) break;
        const retryAfterHeader = err.headers?.get?.("retry-after");
        const waitSeconds = retryAfterHeader ? Number(retryAfterHeader) : (attempt + 1) * 5;
        console.log(`Rate limited (stream) — waiting ${waitSeconds}s before retry ${attempt + 1}/${MAX_TRANSIENT_RETRIES}`);
        await sleep(waitSeconds * 1000);
        continue;
      }
      if (status === 400 && err.error?.code === "tool_use_failed") {
        if (attempt === MAX_TRANSIENT_RETRIES) break;
        await sleep(BASE_BACKOFF_MS * (attempt + 1));
        continue;
      }
      if (status >= 500) {
        if (attempt === MAX_TRANSIENT_RETRIES) break;
        const backoff = BASE_BACKOFF_MS * (attempt + 1);
        console.log(`Upstream ${status} (stream) — retrying in ${backoff}ms (${attempt + 1}/${MAX_TRANSIENT_RETRIES})`);
        await sleep(backoff);
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json|typescript|tsx|jsx|ts|js|css)?\s*\n([\s\S]*?)\n```$/);
  return fenced ? fenced[1]! : trimmed;
}

function parseJSON<T>(text: string, context: string): T {
  try {
    return JSON.parse(stripCodeFences(text)) as T;
  } catch (err) {
    throw new ModelResponseParseError(
      `Failed to parse JSON for ${context}: ${err instanceof Error ? err.message : String(err)}`,
      text,
    );
  }
}

// ─────────────────────────────────────────────────────────────
// PHASE 0: TRIAGE
// ─────────────────────────────────────────────────────────────

export type TriageResult = {
  /**
   * chat        — pure question/explanation, no action needed
   * run-command — start/stop/restart the dev server or run a
   *               shell command. No file changes. verifyCommand required.
   * quick-edit  — one existing file needs a small change
   * full        — new files, multiple files, packages, or restructuring
   */
  mode: "chat" | "run-command" | "quick-edit" | "full";
  /** Only when mode === "chat". */
  reply?: string;
  /** Only when mode === "quick-edit". */
  targetFile?: string;
  /**
   * Required when mode === "run-command".
   * Optional when mode === "quick-edit" (omit if not confident).
   * Must bind to 0.0.0.0, NOT localhost.
   */
  verifyCommand?: string;
  reason: string;
};

const TRIAGE_SYSTEM_PROMPT = `
You are the AI Forge Triage Agent.

Given a user's request and the current workspace listing,
classify it into exactly one of four modes:

────────────────────────────────────────────
"chat"
────────────────────────────────────────────
A pure question or explanation where NO action is needed.
Examples: "what does this function do?", "explain the auth flow",
"why is X named Y?".

CRITICAL: Do NOT use "chat" for requests that involve running,
starting, stopping, or restarting anything. Those are "run-command".
Do NOT use "chat" for any request that implies executing code or
commands.

Also write the actual answer to the user's question in "reply".

────────────────────────────────────────────
"run-command"
────────────────────────────────────────────
The user wants to start, stop, restart, or run something —
the dev server, the app, a script, a build, etc.
No files need to change. Just execute a command.

Examples:
  "start the app"
  "run the dev server"
  "restart the server"
  "run the app"
  "start it"
  "can you run it"
  "launch the project"
  "npm run dev"

For this mode you MUST provide "verifyCommand" — the shell command
that starts the dev server for this project.

The command MUST explicitly bind to all network interfaces, not just
localhost. This project runs inside a container reachable only via
its mapped port, so localhost/127.0.0.1 is insufficient.

Determine the correct flag from the workspace listing (check
package.json scripts, next.config.ts/.js, vite.config.ts/.js):

  Vite / React:   npm run dev -- --host 0.0.0.0
  Next.js:        npm run dev -- --hostname 0.0.0.0

If the dev server is already running, the workflow will stop it
first before restarting. You still provide verifyCommand as normal.

────────────────────────────────────────────
"quick-edit"
────────────────────────────────────────────
A small, self-contained change confined to ONE file that already
exists in the workspace listing. No new files, no new dependencies
between files, no new packages.

Set "targetFile" to that file's exact path.

Optionally set "verifyCommand" if you are confident of the correct
dev-server start command. OMIT if unsure — the workflow will fall
back to full planning rather than skip verification.

────────────────────────────────────────────
"full"
────────────────────────────────────────────
Anything needing new files, multiple files, new dependencies,
new packages, or real restructuring.

────────────────────────────────────────────

Respond with ONLY a JSON object, no prose, no code fences:

{
  "mode": "chat" | "run-command" | "quick-edit" | "full",
  "reply": "string — ONLY when mode is chat",
  "targetFile": "string — ONLY when mode is quick-edit",
  "verifyCommand": "string — REQUIRED when mode is run-command; optional for quick-edit",
  "reason": "one sentence explaining the classification"
}

When in doubt between "quick-edit" and "full", choose "full".
When in doubt between "chat" and "run-command", choose "run-command".
`;

export async function triageRequest(data: PlanRequest): Promise<TriageResult> {
  const userContent = `
SETUP CONTEXT

${JSON.stringify(data.setupContext, null, 2)}

---

CURRENT WORKSPACE LISTING

${data.workspaceListing}

---

USER REQUEST

${data.userPrompt}

---

Classify this request now.
`;

  console.log("===== TRIAGE REQUEST =====");
  console.log(data.userPrompt);
  console.log("===========================");

  const response = await callModelWithRetry(claude, {
    model: MODEL,
    max_tokens: 1024,
    temperature: 0,
    system: TRIAGE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserContent(userContent, data.image) }],
  });

  const text = extractTextContent(response);
  const triage = parseJSON<TriageResult>(text, "triage result");

  const validModes = ["chat", "run-command", "quick-edit", "full"] as const;
  if (!validModes.includes(triage.mode as (typeof validModes)[number])) {
    throw new ModelResponseParseError("Triage result has an invalid mode.", triage);
  }
  if (triage.mode === "chat" && !triage.reply?.trim()) {
    throw new ModelResponseParseError("Triage mode is chat but reply is empty.", triage);
  }
  if (triage.mode === "quick-edit" && !triage.targetFile?.trim()) {
    throw new ModelResponseParseError("Triage mode is quick-edit but targetFile is missing.", triage);
  }
  if (triage.mode === "run-command" && !triage.verifyCommand?.trim()) {
    throw new ModelResponseParseError("Triage mode is run-command but verifyCommand is missing.", triage);
  }

  console.log("===== TRIAGE RESULT =====");
  console.log(`mode=${triage.mode} reason=${triage.reason}`);
  console.log("==========================");

  return triage;
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

export async function planProject(data: PlanRequest): Promise<ExecutionPlan> {
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

  const response = await callModelWithRetry(claude, {
    model: MODEL,
    max_tokens: 4096,
    temperature: 0,
    system: PLAN_SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserContent(userContent, data.image) }],
  });

  const text = extractTextContent(response);
  const plan = parseJSON<ExecutionPlan>(text, "execution plan");

  if (!Array.isArray(plan.files) || plan.files.length === 0) {
    throw new ModelResponseParseError("Execution plan has no files.", plan);
  }

  console.log("===== PLAN RESULT =====");
  console.log(`${plan.files.length} files, ${plan.setupCommands.length} setup commands`);
  console.log(plan.files.map((f) => `  ${f.action} ${f.path} (deps: ${f.dependsOn.join(", ") || "none"})`).join("\n"));
  console.log(`verifyCommand: ${plan.verifyCommand}`);
  console.log("========================");

  return plan;
}

// ─────────────────────────────────────────────────────────────
// DEPENDENCY BATCHING
// ─────────────────────────────────────────────────────────────

export function buildDependencyBatches(files: FilePlan[]): FilePlan[][] {
  const byPath = new Map(files.map((f) => [f.path, f]));
  const remaining = new Set(files.map((f) => f.path));
  const batches: FilePlan[][] = [];

  while (remaining.size > 0) {
    const batch: FilePlan[] = [];

    for (const path of remaining) {
      const file = byPath.get(path)!;
      const unmetDeps = file.dependsOn.filter((d) => remaining.has(d) && byPath.has(d));
      if (unmetDeps.length === 0) batch.push(file);
    }

    if (batch.length === 0) {
      console.log(`WARNING: dependency deadlock among [${[...remaining].join(", ")}] — flushing as one batch.`);
      for (const path of remaining) batch.push(byPath.get(path)!);
    }

    for (const file of batch) remaining.delete(file.path);
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

The entire response is written directly to disk as the file's content.

RULES:

1. Use the dependency file contents provided to import correctly
   and stay consistent with existing types, exports, and styling conventions.

2. If modifying an existing file, preserve unrelated existing
   code and only change what the description requires.

3. Never hardcode credentials. Use environment variables where relevant.

4. Output must be complete and syntactically valid on its own.

5. Never use placeholders such as:
   "// rest of code here"
   "// TODO"
   "// implement this"
   or incomplete sections.
`;

function buildDependencySection(dependencyContents: Record<string, string>): string {
  const entries = Object.entries(dependencyContents);
  if (entries.length === 0) return "(No dependencies — this file does not import from other planned files.)";
  return entries.map(([path, content]) => `--- ${path} ---\n${content}`).join("\n\n");
}

export async function generateFileContent(req: GenerateFileRequest): Promise<string> {
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

${buildDependencySection(req.dependencyContents)}

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

  console.log(`===== GENERATE FILE: ${req.file.path} =====`);

  const response = await callModelStreamWithRetry(
    claude,
    {
      model: MODEL,
      max_tokens: 8192,
      temperature: 0,
      system: GENERATE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserContent(userContent, req.image) }],
    },
    req.onDelta,
  );

  const content = stripCodeFences(extractTextContent(response));
  console.log(`Generated ${content.length} chars for ${req.file.path}`);
  console.log("=============================================");
  return content;
}

// ─────────────────────────────────────────────────────────────
// PHASE 3: FIX FILE
// ─────────────────────────────────────────────────────────────

const FIX_SYSTEM_PROMPT = `
You are the AI Forge Fix Agent.

You are given one file's current content and a build/runtime error.

Produce the corrected complete file content.

Respond with ONLY the raw corrected file content.

No prose.
No explanation.
No markdown code fences.

RULES:

1. Make the smallest change that resolves the reported error.
   Do not restructure unrelated code.

2. Do not introduce new dependencies unless the error explicitly requires it.

3. Output must be complete and syntactically valid on its own.

4. Never omit existing code.

5. Never use placeholders such as:
   "// rest of code here"
   "// TODO"
   "// unchanged code"
`;

export async function fixFile(req: FixFileRequest): Promise<string> {
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

  console.log(`===== FIX FILE: ${req.file.path} =====`);

  const response = await callModelStreamWithRetry(
    claude,
    {
      model: MODEL,
      max_tokens: 8192,
      temperature: 0,
      system: FIX_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    },
    req.onDelta,
  );

  const content = stripCodeFences(extractTextContent(response));
  console.log(`Fixed ${req.file.path}: ${content.length} chars`);
  console.log("========================================");
  return content;
}

// ─────────────────────────────────────────────────────────────
// PHASE 4 SUPPORT: LOG PARSING
// ─────────────────────────────────────────────────────────────

export function extractErrorFilePath(buildLog: string, knownPaths: string[]): string | null {
  for (const knownPath of knownPaths) {
    const escaped = knownPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(^|[\\s./])${escaped}([:(]|\\s|$)`, "m");
    if (pattern.test(buildLog)) return knownPath;
  }
  return null;
}

export function extractMissingPackage(buildLog: string): string | null {
  const match = buildLog.match(/Module not found:.*?Can't resolve ['"]([^'"./][^'"]*)['"]/i);
  return match ? match[1]! : null;
}
