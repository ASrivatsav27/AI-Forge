<div align="center">

# AI Forge

**Describe an application in plain English. AI Forge plans it, scaffolds it, generates the code in parallel, runs it in an isolated container, and hands you a verified live preview.**

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=nodedotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Bun](https://img.shields.io/badge/Bun-frontend-000000?logo=bun&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-project%20containers-2496ED?logo=docker&logoColor=white)
![Inngest](https://img.shields.io/badge/Inngest-workflows-5B3DF5)
![Socket.IO](https://img.shields.io/badge/Socket.IO-realtime-010101?logo=socketdotio&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Prisma-4169E1?logo=postgresql&logoColor=white)

<br/>

**[🚀 Live Application](https://app.adapasrivatsav.in)** &nbsp;·&nbsp; **[▶ Watch the Demo](DEMO_URL)**

</div>

---

## Demo

> **Prompt → Setup → Generate → Run → Live Application**

[**▶ Watch the AI Forge Demo**](DEMO_URL)

<!-- Replace DEMO_URL with the final video link (GitHub Release asset, or a user-attachments URL). -->

The demo shows the **complete generation process**, not just the finished landing page:

1. **Prompt** – a single natural-language description of the app.
2. **Setup** – the Setup Agent scaffolds the framework inside a fresh, isolated container and brings up a dev server.
3. **Generate** – the Coding Agent plans the project and writes files in parallel while you watch each file appear in the editor.
4. **Run** – the dev server is started and the preview is verified over HTTP.
5. **Live application** – the generated app renders in the in-app preview, editable in the workspace.

---

## Live Application

AI Forge is deployed and running at **[https://app.adapasrivatsav.in](https://app.adapasrivatsav.in)**.

| Component | Where it runs | Address |
|---|---|---|
| Frontend (React SPA) | Vercel | `https://app.adapasrivatsav.in` |
| Backend API + Socket.IO + workflows | AWS EC2 (Docker) | `https://api.adapasrivatsav.in` |
| Generated app previews | Project containers on the EC2 host | `https://<port>.preview.adapasrivatsav.in` |

To try it: open the app, sign up (email/password, Google or GitHub), pick a stack, describe your application and click **Generate**.

---

## What is AI Forge?

AI Forge is an AI-powered application generation platform. You describe what you want, pick a stack (Next.js, React + Vite, or React + Express with PostgreSQL/MongoDB), and AI Forge builds a working project you can see running, edit in a browser IDE, and keep iterating on with follow-up prompts.

It is for developers, founders and teams who want a runnable starting point, not a code snippet to paste.

**What happens after you enter a prompt:** a project row, a dedicated workspace directory and a dedicated Docker container are created; a Setup Agent scaffolds the framework and gets a dev server running; a Coding Agent plans the work as a dependency graph of files and generates them in parallel; the platform installs packages, starts the dev server, detects the port, probes it over HTTP, and, if the build fails, feeds the error back to a fix step.

**Why this is more than an LLM wrapper:** the models only decide *what to do next*. Around them, AI Forge is an **agent harness**: the runtime that executes commands in a container, feeds real results back as observations, verifies the preview, enforces limits, and recovers from failure.


| A plain LLM call | AI Forge |
|---|---|
| Returns code in a chat message | Writes files into a real workspace and runs them |
| No idea whether the code works | Starts the dev server, detects the port, probes the preview over HTTP |
| Failure means you debug it | Build/runtime errors are captured and fed to a fix step (up to 3 attempts), and missing npm packages are auto-installed |
| One big response | A plan, then one model call per file, in dependency-aware parallel batches |
| Stateless | Durable Inngest workflows, a project database, and per-project sessions that can be recovered |
| Terminal output is invisible | Live agent status, file-by-file generation, terminal and file tree streamed over Socket.IO |

---

## Core Capabilities

Everything below is implemented in this repository.

- **Natural-language app generation** with stack selection: Next.js, Next.js + DB, React (Vite), React + Express, React + Express + DB (PostgreSQL or MongoDB).
- **Setup Agent**: a tool-using agent (`executeCommand`, `readFile`, `writeFile`, `sendInput`, `finish`) that scaffolds the selected framework and gets a verified dev server running.
- **AI project planning**: the Planning Agent returns a JSON plan: files, per-file dependencies, setup commands and a verify command.
- **Dependency-aware parallel file generation**: files are grouped into batches by their `dependsOn` graph; each batch is generated concurrently.
- **Request triage for follow-ups**: follow-up prompts are classified as `chat`, `run-command`, `quick-edit` or `full`, so a question doesn't trigger a rebuild and a one-line change doesn't re-plan the project.
- **Image-aware follow-ups**: a reference image (PNG/JPEG/GIF/WebP) can be attached to a follow-up prompt.
- **Isolated per-project workspaces and containers**: one workspace directory and one Docker container per project.
- **Preview detection and verification**: port detected from dev-server output, mapped to the Docker host port, and probed over HTTP.
- **Error-driven fixing**: failed verification triggers missing-package install or a targeted file fix, then re-verification.
- **Retry and failure handling** at three levels: model calls, Inngest steps/workflows, and the fix loop.
- **Real-time updates over Socket.IO**: agent phase/status, per-file generation events, terminal output, file tree, preview state.
- **Browser workspace**: Monaco editor, xterm.js terminal attached to the project container, file explorer, live generation cards, agent activity panel and an embedded preview.
- **Authentication**: email/password plus Google and GitHub OAuth through Better Auth; projects are stored per user in PostgreSQL via Prisma.
- **Session recovery**: if the backend lost a project's in-memory session, setup and coding workflows recreate it from the database and the still-running container.

---

## How It Works

```
 User
  │  prompt + stack selection
  ▼
 Frontend (React / Bun)  ── REST ──────────────┐
  ▲                                             ▼
  │                                   Backend API (Express 5)
  │  Socket.IO (agent:*, terminal:*,    │  create workspace dir
  │  preview:*, filetree:*)             │  create project container
  │                                     │  insert Project row (Postgres)
  │                                     │  open PTY session (docker exec)
  │                                     ▼
  │                         Inngest event: project/setup.requested
  │                                     ▼
  │                         ┌──────── setup-workflow ────────┐
  │                         │ Setup Agent loop (tool calls)  │
  │                         │ scaffold → install → dev server│
  │                         │ preview verified → READY       │
  │                         └───────────────┬────────────────┘
  │                                         ▼
  │                         Inngest event: project/coding.requested
  │                                         ▼
  │                         ┌──────── coding-workflow ───────┐
  │                         │ (follow-ups: Triage first)     │
  │                         │ Plan → setup commands          │
  │                         │ Dependency batches ─┬─ file A  │
  │                         │  (parallel)         ├─ file B  │
  │                         │                     └─ file C  │
  │                         │ Start dev server → verify      │
  │                         │ fail → fix → re-verify (≤3)    │
  │                         └───────────────┬────────────────┘
  │                                         ▼
  │                  Project container (/app = /workspaces/<projectId>)
  │                         dev server on 0.0.0.0:<port>
  │                                         ▼
  └──────────────────────────── live preview URL ◄─── User
```

### What happens when you click **Generate**

1. **Request.** The dashboard sends `POST /project/createProject` with the app prompt, a stack-specific *setup prompt* and the stack selection. The setup prompt is deliberately separate from the app prompt: the Setup Agent never sees the app requirements, and the Coding Agent never sees scaffolding instructions.
2. **Provisioning.** The backend generates a `projectId` (UUID), creates `/workspaces/<projectId>`, starts the container `project-<projectId>` (`node:20-alpine`) with that directory bind-mounted at `/app`, inserts the `Project` row, and opens a PTY session by running `docker exec -it <container> /bin/sh` under `node-pty`. A `chokidar` watcher on the workspace pushes file-tree updates to the browser.
3. **Setup workflow.** The backend emits `project/setup.requested` to Inngest. The Setup Agent runs a tool-calling loop (max 40 iterations): each tool result is fed back as an observation until it calls `finish`. Setup succeeds only if the runtime has independently reported a verified preview. The project is then marked `READY`.
4. **Hand-off.** `setup-workflow` emits `project/coding.requested` (`isFollowUp: false`).
5. **Coding workflow.** The dev server left running by setup is stopped; the workspace is listed; the Planning Agent produces the file plan; setup commands run in the container; files are generated in parallel batches; the dev server is started and verified.
6. **Verification and repair.** On failure the error text is parsed: a missing package is installed, otherwise the implicated file is regenerated with the error in context. Up to 3 fix attempts.
7. **Done.** `preview:ready` is emitted with the host port and the frontend shows the preview.

---

## AI Agent Architecture

AI Forge is an **agentic coding system**, not `prompt → LLM → code`. Responsibilities are split across specialised agents, with the *platform*, not the model, owning execution, verification and state. That platform layer is the **agent harness**:

- **Execution:** commands run through a PTY inside the project's own container (`executeCommand`, `sendInput`), and file tools are confined to the workspace.
- **Observation:** the harness turns what really happened (command finished, prompt appeared, preview ready/error/stopped) into the events the agents see.
- **Verification:** port detection plus an HTTP probe decide whether a preview is ready. The model's opinion doesn't count.
- **Control:** iteration caps, retry/backoff, fix-attempt limits, per-project concurrency and session recovery.
- **Visibility:** status, file and terminal events streamed to the browser over Socket.IO.

The Setup Agent and Coding Agent are the model-driven parts. Everything listed above belongs to the harness.

| Agent | Where | Responsibility | Model call |
|---|---|---|---|
| **Setup Agent** | `backend/src/agents/setup.agent.ts` | Scaffold the selected framework, install dependencies, start a dev server | Tool-calling loop, `tool_choice: "required"`, exactly one tool call per turn, temperature 0, via an OpenAI-compatible client. Model id as configured in code: `qwen/qwen3.8-27b` |
| **Triage Agent** | `coding.agent.ts` → `triageRequest` | *Follow-ups only.* Classify as `chat`, `run-command`, `quick-edit` or `full` | One JSON response, temperature 0 |
| **Planning Agent** | `coding.agent.ts` → `planProject` | Produce `{ files[], setupCommands[], verifyCommand }` as JSON | One JSON response, temperature 0 |
| **File Generation Agent** | `coding.agent.ts` → `generateFileContent` | Produce the complete content of **one** file (create or modify) given its dependencies' contents | One call per file |
| **Fix Agent** | `coding.agent.ts` → `fixFile` | Rewrite one file given the build/runtime error | One call per fix attempt |

Coding-side agents use the Anthropic SDK with model id `claude-opus-4-8` (constant `MODEL` in `coding.agent.ts`).

### Setup Agent

- **Tools:** `executeCommand`, `readFile`, `writeFile`, `sendInput` (for interactive CLI prompts such as `create-next-app`), `finish`. `readFile`/`writeFile` are restricted to the workspace (path-escape check).
- **Observations come from the harness as factual runtime events**, not model guesses: `promptDetected`, `commandCompleted`, `previewReady`, `previewError`, `previewStopped`.
- **Guardrails:** max 40 iterations; a sliding window of the last 15 actions; a truncated or malformed tool call is rejected (non-retriable) rather than acted on; `finish` without a verified preview is an error.
- **Recovery:** if the in-memory session is gone, it is recreated, the workspace is probed (`package.json`, `node_modules`, file listing) and the agent resumes from that observation. Max 3 recovery attempts, tracked in `Project.setupAttempts`.
- Its prompt also carries the preview-origin configuration (`allowedDevOrigins` for Next.js, `server.allowedHosts` for Vite) so the dev server accepts requests from the preview domain.

### Coding Agent

1. **Triage (follow-ups only).**
   - `chat` → answer returned as an `agent:message`; no files touched.
   - `run-command` → run the given command and verify the preview; if it fails, fall back to full planning.
   - `quick-edit` → regenerate one file, restart and verify; if that fails, fall back to full planning.
   - `full` → proceed to planning.
2. **Plan.** One JSON plan: files with `create`/`modify`, one-or-two-sentence description and `dependsOn`; setup commands; and the exact verify command (which must bind to `0.0.0.0` because the app runs in a container).
3. **Setup commands.** Run sequentially in the project container's PTY.
4. **Generate.** See [Parallel Code Generation](#parallel-code-generation).
5. **Verify.** Start the verify command, wait for a runtime event (`previewReady` / `previewError` / `previewStopped`).
6. **Fix.** Up to `MAX_FIX_ATTEMPTS = 3` repair rounds (so up to 4 verification runs):
   - *"Module not found: Can't resolve 'x'"* → `npm install x`, restart, re-verify.
   - Otherwise → locate the offending file from the error log (fallback: last file written), regenerate it with the error as context, restart, re-verify.
7. **Result.** After the final attempt the workflow fails with the last error, which is surfaced to the UI as an `error` status.

### Tool use, retries and failure handling

- **Model-call retries** (`coding.agent.ts`): up to 3 retries with linear backoff for network errors (`ECONNRESET`, `ETIMEDOUT`, …), 5xx, `tool_use_failed` and empty responses; `429` waits for `retry-after` (or 5 s × attempt); a request that hits the client deadline is retried once. The per-attempt deadline defaults to 240 s (`CLAUDE_REQUEST_TIMEOUT_MS`). A "tokens per day" 429 raises a dedicated `DailyTokenLimitError` and is not retried.
- **Workflow retries:** both Inngest functions are configured with `retries: 2`. Completed `step.run` steps are memoised by Inngest, so a retry resumes rather than regenerating everything.
- **Failure state:** `setup-workflow`'s `onFailure` writes `setupStatus = FAILED` and `setupError` to the database and emits an `error` status.
- **Streaming/status updates:** every phase (`setup:*`, `coding:planning`, `coding:triage`, `coding:generating`, `coding:verifying`, `coding:fixing`, `coding:installing`, `coding:done`, `error`) is emitted to the project's Socket.IO room.

> **How "live" file streaming works.** File generation uses a normal (non-streaming) model call. Once the full file text is back, the backend *replays* it to the browser in small chunks (~1,200 chars/s, capped at 10 s per file) as `agent:file-delta` events, so the editor shows the file being written. The visual effect is live; the underlying call is not token-streamed.

---

## Parallel Code Generation

The Planning Agent declares, for each file, which other planned files it imports from or reads (`dependsOn`). `buildDependencyBatches()` turns that graph into ordered batches:

```
Plan (files + dependsOn)
        │
        ▼
Batch 1: files with no unmet dependencies ──► generated in parallel
        │      (results kept in memory as writtenContent)
        ▼
Batch 2: files whose dependencies were all in earlier batches
        │      each call receives its dependencies' generated contents
        ▼
Batch N …
        │
        ▼
Workspace (/workspaces/<projectId>) ──► start dev server ──► verify
```

How it actually works:

- Each batch is run with `Promise.all`, and each file is its own Inngest `step.run("generate-<path>")`, so every file is individually retryable and memoised.
- A file that depends on others receives **the full generated content of those dependencies** in its prompt, so imports, types and exports line up.
- The planner is instructed to keep the graph "shallow and wide" so most files land in the first batches.
- A dependency cycle is not fatal: the remaining files are flushed as one batch with a logged warning.
- **Concurrency cap:** the coding workflow is limited to `concurrency: { limit: 4, key: "event.data.projectId" }`, so at most 4 generation steps run at once *per project*, which avoids sending a whole batch (~20 requests) to the model provider simultaneously.

Benefits: faster generation than one-file-at-a-time, independent files don't wait on each other, dependent files are generated with real context, and per-file steps make failures cheap to retry.

---

## Project Isolation / Multi-User Architecture

Each project is a separate unit identified by a UUID `projectId`:

| Layer | Isolation mechanism (from the code) |
|---|---|
| Identity | `projectId` = `uuidv4()`; stored in `Project` with `workspacePath` and `containerId` both `@unique` |
| Ownership (REST) | Project reads and follow-up prompts query with `{ id: projectId, userId }` behind `requireAuth` |
| Filesystem | `/workspaces/<projectId>` on the backend; `readWorkspaceFile`/`writeWorkspaceFile` reject any path that resolves outside the workspace root |
| Execution | One container per project, named `project-<projectId>` (`node:20-alpine`), with only that project's directory bind-mounted at `/app` |
| Network/preview | Container ports 3000, 3001, 5173 and 8000 are published to **Docker-assigned ephemeral host ports** (`HostPort: "0"`), so concurrent projects never collide |
| Terminal | A PTY per project running `docker exec` into *that* container |
| Realtime | Socket.IO room named after the `projectId`; all `agent:*`, `terminal:*`, `preview:*` and `filetree:*` events are emitted to that room only |
| Workflow state | Inngest events carry `projectId`; per-project concurrency key; in-memory session, event queue and active-command state are keyed by `projectId` |
| Lifecycle | When the last browser client for a project sends `terminal:disconnect`, the watcher is closed, the PTY killed and the container stopped; reconnecting restarts it (`ensureContainerRunning`) and replays preview state |

**Why Project A can't modify Project B:** every file operation is rooted at its own project's workspace and rejects escapes; every shell command runs inside its own container, which only sees its own directory; ports are distinct; and events are routed by room. Multiple generations run concurrently because each project has its own container, PTY and event queue, and Inngest runs workflow executions independently, with the per-project cap of 4 on parallel file generations.

---

## Infrastructure / Deployment Architecture

`main` and `production` are two branches of the **same** product. In the current history, `main` carries the newer frontend deployment configuration (environment-driven API/socket/auth URLs, `vercel.json` SPA rewrite, TLS preview subdomains) and `production` carries the newer backend (hardened CORS, the Dockerised EC2 setup, bounded model timeouts, per-project generation concurrency, the setup agent's preview-origin configuration). Deploy the frontend from `main` and the backend from `production`.

```
                         ┌──────────────────────┐
                         │         User         │
                         └──────────┬───────────┘
                                    │ HTTPS
                                    ▼
                         ┌──────────────────────┐
                         │   Vercel (Frontend)  │
                         │ React SPA, built with │
                         │       Bun            │
                         └──────────┬───────────┘
                                    │  REST (cookies) + Socket.IO
                                    ▼
          ┌──────────────────────── AWS EC2 ─────────────────────────┐
          │                                                           │
          │  ┌─ Docker Compose (network: forge) ───────────────────┐  │
          │  │                                                     │  │
          │  │  ┌─────────────────┐   events   ┌────────────────┐  │  │
          │  │  │ backend :8000   │◄──────────►│ inngest :8288  │  │  │
          │  │  │ Express +       │  functions │ (dev server)   │  │  │
          │  │  │ Socket.IO +     │            └────────────────┘  │  │
          │  │  │ agents/workflows│                                │  │
          │  │  └───┬─────────┬───┘                                │  │
          │  └──────┼─────────┼────────────────────────────────────┘  │
          │         │         │ /var/run/docker.sock                  │
          │         │         ▼                                       │
          │         │  ┌─────────────────────────────────────────┐    │
          │         │  │ project-<id-1>   project-<id-2>   …     │    │
          │         │  │ node:20-alpine, /app ◄── /workspaces/<id>│    │
          │         │  │ dev servers on ephemeral host ports      │    │
          │         │  └─────────────────────────────────────────┘    │
          └─────────┼─────────────────────────────────────────────────┘
                    ▼
        PostgreSQL (DATABASE_URL — external to the compose file)

 Generated apps are shown to the user at  https://<hostPort>.preview.adapasrivatsav.in
 (the wildcard proxy that maps this to the container's host port is *not* in this repository)
```

**What the repository confirms**

- **Frontend:** a Bun-built static SPA (`bun run build` → `dist/`) with a Vercel SPA-rewrite `vercel.json`; the backend allow-lists several `*.vercel.app` origins and `app.adapasrivatsav.in`.
- **Backend:** a multi-stage `Dockerfile` (Node 22 + official Docker CLI + native build tools for `node-pty`) and a `docker-compose.yml` that runs `backend` and a self-hosted Inngest server on a shared `forge` network, mounts the host Docker socket and the shared `workspaces` directory, and maps `host.docker.internal` to the host gateway so the backend can probe project containers' published ports.
- **Process manager alternative:** `ecosystem.config.cjs` (PM2) exists for running without Docker; its Inngest entry uses `cmd.exe`, so it is Windows-oriented.

**What needs confirmation** (not verifiable from the repository)

- Reverse proxy / TLS termination for `api.adapasrivatsav.in` on EC2.
- The wildcard proxy for `*.preview.adapasrivatsav.in` that forwards `<port>` to the host.
- Where PostgreSQL is hosted.
- Exact EC2 instance size, OS and Elastic IP/DNS setup.
- Vercel project settings (root directory, build command, output directory).

### Why EC2 (and not a serverless backend)

The backend is not a stateless request handler. It needs to:

- **Talk to the Docker daemon** (create/start/stop/inspect containers, `docker exec` PTYs), which requires access to a host Docker socket.
- **Own a persistent filesystem**: every project's workspace is a bind mount shared between the backend and the project container.
- **Hold long-lived connections** (Socket.IO, PTYs, `chokidar` watchers) and **in-memory session state** per project.
- **Run long workflows and dev servers** that live for minutes to hours.
- **Publish dynamic ports** for each generated application.

A single always-on Linux VM running Docker satisfies all of this directly; function-as-a-service platforms do not.

---

## Deployment

### Frontend Deployment

**1. Prerequisites**

- A Vercel account and this repository imported into Vercel.
- [Bun](https://bun.sh) for local builds.
- The backend already deployed and reachable over HTTPS (the browser will block mixed content from an HTTPS site).

**2. Environment variables**

Values prefixed `VITE_` are inlined at **build time** (`env: "VITE_*"` in `frontend/build.ts`):

| Variable | Purpose | Default if unset |
|---|---|---|
| `VITE_API_URL` | Base URL of the project API, **including `/project`** | `http://localhost:8000/project` |
| `VITE_SOCKET_URL` | Socket.IO server URL | `http://localhost:8000` |
| `VITE_AUTH_URL` | Better Auth base URL (the backend origin) | `http://localhost:8000` |

**3. Build locally (optional check)**

```bash
git checkout main
cd frontend
bun install
VITE_API_URL=https://api.example.com/project \
VITE_SOCKET_URL=https://api.example.com \
VITE_AUTH_URL=https://api.example.com \
bun run build        # output in frontend/dist
```

**4. Deploy to Vercel**

- Import the repo, set **Root Directory** to `frontend`.
- Build command: `bun run build`. Output directory: `dist`. *(Recommended values derived from `package.json`/`build.ts`; the repo does not contain a Vercel project export, so confirm in your dashboard.)*
- `frontend/vercel.json` rewrites every path to `/index.html` so client-side routes like `/dashboard` work on refresh.

**5. Production environment variables**

Add the three `VITE_*` variables above in *Project → Settings → Environment Variables* and redeploy (they are baked in at build time).

**6. Backend URL configuration**

Use the same public backend origin for all three variables. Then make sure the **backend** allows your frontend origin. Allowed origins are hard-coded in three places and must include your Vercel/custom domain:

- `backend/src/app.ts` (`allowedOrigins`, Express CORS)
- `backend/index.ts` (Socket.IO `cors.origin`)
- `backend/src/utils/auth.ts` (Better Auth `trustedOrigins`)

Also note that `getOAuthCallbackURL()` in `Login.tsx`/`Register.tsx` returns `https://app.adapasrivatsav.in/dashboard` for any non-localhost host; change it if you use a different domain. Auth cookies are shared across subdomains via `crossSubDomainCookies` on `.adapasrivatsav.in`; adjust that domain in `utils/auth.ts` for your own domain.

**7. Socket.IO configuration**

`frontend/src/sockets/socket.ts` connects to `VITE_SOCKET_URL` with `withCredentials: true`. The backend Socket.IO server is on the same port as the API (8000), so your proxy must forward WebSocket upgrades.

---

### Backend Deployment (AWS EC2)

Use the `production` branch.

**1. Provision EC2**

A Linux instance (the repository doesn't pin an OS or size; the commands below assume Ubuntu). Give it enough CPU, RAM and disk for several concurrent Node projects (each project container runs `npm install` and a dev server). Attach an Elastic IP and point your API DNS name at it.

**2. Install Docker (with the Compose plugin)**

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker
docker compose version
```

**3. Clone the repository**

```bash
git clone https://github.com/ASrivatsav27/AI-Forge.git
cd AI-Forge
```

**4. Select the branch**

```bash
git checkout production
```

**5. Configure `.env`**

Create `backend/.env` (it is read via `env_file` in compose and is excluded from the image by `.dockerignore`). Variables used by the code:

```bash
# Database (PostgreSQL, external to compose)
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DBNAME

# Better Auth
BETTER_AUTH_URL=https://api.example.com
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...

# Model providers
ANTHROPIC_API_KEY=...            # Coding Agent (Triage / Plan / Generate / Fix)
GROQ_API_KEY=...                 # Setup Agent client
CLAUDE_REQUEST_TIMEOUT_MS=240000 # optional, per-attempt model deadline

# Docker / workspaces
CONTAINER_DOCKER_SOCKET=/var/run/docker.sock
HOST_WORKSPACE_PATH=/home/ubuntu/AI-Forge/workspaces   # ABSOLUTE host path, see note below
```

The Anthropic client's base URL is set in `backend/src/services/ai.service.ts`; check that it points where you intend before supplying a key.

`WORKSPACE_PATH`, `DOCKER_HOST_GATEWAY`, `INNGEST_BASE_URL` and `INNGEST_EVENT_KEY` are set for you in `docker-compose.yml`.

> **The workspace path rule.** Compose mounts `../workspaces` (relative to `backend/`, i.e. `<repo>/workspaces`) into the backend container at `/workspaces`. Because project containers are started through the *host's* Docker daemon, they must bind-mount the **host** path. `HOST_WORKSPACE_PATH` must therefore be the absolute host path of that same directory. If they differ, generated files will be written where the project container can't see them.

Other environment variables referenced in code but not required on EC2: `WINDOWS_DOCKER_SOCKET` (commented-out, local Windows use), `OPENROUTER_API_KEY` and `UNOROUTER_API_KEY` (clients are defined in `ai.service.ts`, not used by the agents above).

**6. Prepare the database**

The repository contains Prisma migrations (`backend/prisma/migrations`) but the Docker image does not run them automatically. Apply them once against your database before first start, for example from the instance:

```bash
cd backend
npm ci
npx prisma migrate deploy      # uses DATABASE_URL via prisma.config.ts
```

(Running this *inside* the runtime container is not verified: `prisma.config.ts` isn't copied into the runtime image.)

**7. Build Docker images**

```bash
cd ~/AI-Forge/backend
mkdir -p ../workspaces
docker compose build
```

**8. Start Docker Compose**

```bash
docker compose up -d
docker compose ps
```

This starts `inngest` (`inngest dev -u http://backend:8000/api/inngest --no-discovery`, port 8288) and `backend` (port 8000), both with `restart: unless-stopped`.

**9. Expose required ports / 10. Security groups**

| Port | Purpose | Exposure |
|---|---|---|
| 22 | SSH | Your IP only |
| 80 / 443 | TLS reverse proxy in front of the API and preview subdomains | Public *(proxy config is not in this repo – needs confirmation)* |
| 8000 | Backend API + Socket.IO | Behind the reverse proxy; avoid exposing it directly if you terminate TLS on the proxy |
| 8288 | Inngest dev server UI/API | **Do not expose publicly**; use an SSH tunnel to inspect |
| Docker ephemeral range (Linux default 32768–60999) | Project dev servers published on random host ports | Reachable only by the local reverse proxy; do **not** open publicly |

The compose file publishes 8000 and 8288 on all interfaces, so the security group is what keeps 8288 private. Consider binding them to `127.0.0.1` in the `ports:` mapping.

**11. Verify the backend**

```bash
curl http://localhost:8000/
# {"message":"Server is running"}

docker compose logs -f backend
```

Open the Inngest UI through a tunnel (`ssh -L 8288:localhost:8288 <host>` → http://localhost:8288) and confirm that `setup-workflow` and `coding-workflow` are registered.

**12. Logs, restart and update**

```bash
docker compose ps
docker compose logs -f backend
docker compose logs -f inngest

# update to the latest production code
cd ~/AI-Forge && git pull origin production
cd backend && docker compose up -d --build

docker compose restart backend
docker compose down            # stop (workspaces on disk are kept)
```

> **Security note.** The backend container mounts `/var/run/docker.sock`, which gives it control over the host's Docker daemon. Treat the EC2 instance as a dedicated host for AI Forge, keep it patched, and restrict who can reach it.

---

## Local Development

Requires Docker, Node 22, Bun and a PostgreSQL database.

```bash
# Backend
cd backend
# create backend/.env with the variables listed in the deployment section
npm install
npx prisma migrate dev
npm run dev            # tsx watch index.ts → :8000
npx inngest-cli@latest dev -u http://127.0.0.1:8000/api/inngest   # separate terminal

# Frontend
cd frontend
bun install
bun dev                # → http://localhost:3000
```

For local development set `CONTAINER_DOCKER_SOCKET` to your Docker socket (`config/docker.ts` still has a commented-out `WINDOWS_DOCKER_SOCKET` option for running directly on Windows), set `WORKSPACE_PATH` and `HOST_WORKSPACE_PATH` to the same local directory, and leave `DOCKER_HOST_GATEWAY` unset so the preview probe uses `localhost`. The frontend's default URLs already point to `http://localhost:8000`. On `main`, the preview iframe expects `https://<port>.preview.adapasrivatsav.in`; locally you'd need to point it at `http://localhost:<port>` (the `production` branch's `ProjectPreview.tsx` does this).

---

## Tech Stack

| Area | Technology |
|---|---|
| Frontend | React 19, React Router, Tailwind CSS 4, shadcn/Radix UI, Framer Motion, Monaco Editor, xterm.js, Socket.IO client, Axios, built and served with Bun |
| Backend | Node.js 22, Express 5, Socket.IO, Inngest, Dockerode, node-pty, chokidar, Better Auth |
| Data | PostgreSQL with Prisma 7 (`@prisma/adapter-pg`) |
| AI | Anthropic SDK (Coding Agent), OpenAI-compatible SDK (Setup Agent) |
| Infra | Docker, Docker Compose, AWS EC2, Vercel |

## Repository Layout

```
AI-Forge/
├── backend/
│   ├── index.ts                     # HTTP + Socket.IO server, terminal/file events
│   ├── Dockerfile  docker-compose.yml  ecosystem.config.cjs
│   ├── prisma/                      # schema + migrations
│   └── src/
│       ├── agents/                  # setup.agent.ts, coding.agent.ts
│       ├── workflows/               # setup.workflow.ts, coding.workflow.ts (Inngest)
│       ├── session/                 # PTY + watcher + preview detection per project
│       ├── services/                # docker, previewProbe, runtime-events, agent-status
│       ├── tools/                   # executeCommand, workspace file tools
│       ├── controllers/ routes/ middleware/ socket/ utils/ types/
└── frontend/
    ├── vercel.json  build.ts
    └── src/features/                # landing, auth, workspace (editor, terminal, preview, agent panel)
```

## Current Limitations

Documented so contributors know where the edges are:

- **Single backend instance.** Sessions, the runtime-event queue, active-command tracking and the Socket.IO rooms live in process memory.
- **Preview "ready" means HTTP 2xx.** The probe checks the status code, not rendered content.
- **Inngest runs in dev-server mode** in the provided compose file.
- **Socket.IO** terminal/file events are scoped by `projectId` room; the REST API is additionally scoped by `userId`. Per-user authorisation on the socket layer is not implemented in the code reviewed.
- **Frontend preview URL** depends on external wildcard DNS/proxy infrastructure that is not part of this repository.

---

*AI Forge is built by [Adapa SriVatsav](https://github.com/ASrivatsav27).*
