import { inngest } from "../config/inngest.js";
import { NonRetriableError } from "inngest";
import { prisma } from "../config/db.js";
import { getIO } from "../socket/io.js";
import { createSession } from "../session/createSession.js";
import { ensureContainerRunning } from "../services/docker.service.js";
import { setupAgent } from "../agents/setup.agent.js";
import { sessions } from "../session/session.manager.js";
import { executeCommand, sendInput, waitForCommandResult, markCommandDetached, } from "../services/executeCommand.js";
/* ============================================================
   CONFIG
   ============================================================ */
const MAX_ITERATIONS = 40;
const MAX_RECOVERY_ATTEMPTS = 3;
const PREVIEW_WAIT_TIMEOUT = 60_000;
const CTRL_C_TIMEOUT = 10_000;
/* ============================================================
   COMMAND TYPE DETECTION
   ============================================================ */
/*
 * Determine if a command is a setup/installation command
 * that does NOT necessarily produce a preview.
 *
 * Examples:
 *   npm create vite@latest
 *   npx create-next-app@latest
 *   npm install
 *   pnpm install
 *
 * These commands should be allowed to complete without
 * declaring PREVIEW FAILED merely because no server started.
 */
function isSetupCommand(command) {
    const normalized = command.toLowerCase().trim();
    /*
     * Project creation commands
     */
    if (/^(npm|npx|pnpm|yarn)\s+(create|init)/.test(normalized)) {
        return true;
    }
    /*
     * Dependency installation
     */
    if (/^(npm|pnpm|yarn)\s+(install|i|ci)\b/.test(normalized)) {
        return true;
    }
    /*
     * Common setup/config commands
     */
    if (/^(npm|pnpm|yarn)\s+run\s+(setup|build|postinstall)\b/.test(normalized)) {
        return true;
    }
    return false;
}
/*
 * Determine if a command is explicitly a development server command.
 *
 * Examples:
 *   npm run dev
 *   npm start
 *   next dev
 *   vite --host
 *
 * These commands ARE expected to produce a preview.
 */
function isDevServerCommand(command) {
    const normalized = command.toLowerCase().trim();
    /*
     * Host/hostname flags are strong indicators of dev server intent
     */
    if (/--host(name)?\s/.test(normalized) ||
        normalized.endsWith('--host') ||
        normalized.endsWith('--hostname')) {
        return true;
    }
    /*
     * Common dev server patterns
     */
    if (/^(npm|pnpm|yarn)\s+run\s+(dev|start)\b/.test(normalized) ||
        /^(npm|pnpm|yarn)\s+start\b/.test(normalized)) {
        return true;
    }
    /*
     * Framework-specific dev commands
     */
    if (/^(next|vite|nuxt)\s+(dev)?\b/.test(normalized)) {
        return true;
    }
    return false;
}
/* ============================================================
   CTRL+C
   ============================================================ */
function isCtrlCInput(input) {
    return (input === "\u0003" ||
        input === "\\u0003" ||
        input === "\x03");
}
/* ============================================================
   WAIT FOR CREATESESSION PREVIEW STATE
   ============================================================ */
/*
 * IMPORTANT:
 *
 * createSession is the SOURCE OF TRUTH for preview detection.
 *
 * It is responsible for:
 *
 *   PTY output
 *       ↓
 *   application port
 *       ↓
 *   Docker host port
 *       ↓
 *   HTTP probe
 *       ↓
 *   session.preview
 *
 * The workflow DOES NOT inspect terminal output for ports.
 * The workflow DOES NOT guess Vite/Next ports.
 *
 * It only observes:
 *
 *   session.preview.state
 *   session.preview.hostPort
 */
async function waitForSessionPreview(session, timeout = PREVIEW_WAIT_TIMEOUT) {
    const start = Date.now();
    console.log("Waiting for createSession preview state...");
    while (Date.now() - start <
        timeout) {
        const state = session.preview.state;
        const hostPort = session.preview.hostPort;
        /*
         * createSession has successfully:
         *
         * - detected the application port
         * - found the Docker host port
         * - verified HTTP access
         */
        if (state === "READY") {
            if (!hostPort) {
                return {
                    kind: "previewFailed",
                    reason: "Preview state is READY but createSession did not provide a host port.",
                };
            }
            console.log("===== PREVIEW READY =====");
            console.log("Host port:", hostPort);
            console.log("=========================");
            return {
                kind: "previewReady",
                hostPort,
            };
        }
        /*
         * createSession detected a server but
         * preview verification failed.
         */
        if (state === "ERROR") {
            return {
                kind: "previewFailed",
                reason: "createSession reported that preview verification failed.",
            };
        }
        /*
         * Server was explicitly stopped.
         */
        if (state === "STOPPED") {
            return {
                kind: "previewStopped",
                reason: "The development server stopped before preview became ready.",
            };
        }
        /*
         * STARTING is normal.
         *
         * Do NOT start another server.
         *
         * createSession is still handling:
         *
         * port detection
         * Docker mapping
         * preview probing
         */
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return {
        kind: "previewFailed",
        reason: "Timed out waiting for createSession to report a verified preview.",
    };
}
/* ============================================================
   COMMAND OR PREVIEW
   ============================================================ */
/*
 * IMPORTANT: TWO COMMAND MODES
 *
 * MODE 1: SETUP/INSTALLATION COMMANDS
 * ------------------------------------
 * Examples: npm create vite, npx create-next-app, npm install
 *
 * These commands are allowed to complete without requiring preview.
 * The absence of preview during installation is NORMAL.
 *
 * However, if createSession independently detects a real preview
 * (e.g., Vite auto-start), we can transition early.
 *
 * MODE 2: DEVELOPMENT SERVER COMMANDS
 * ------------------------------------
 * Examples: npm run dev, npm start
 *
 * These commands ARE expected to produce a preview.
 * We explicitly wait for preview state with timeout.
 */
async function waitForCommandOrPreview(session, commandPromise, command) {
    const isSetup = isSetupCommand(command);
    const isDevServer = isDevServerCommand(command);
    /*
     * MODE 1: SETUP/INSTALLATION COMMAND
     *
     * Primary: wait for command completion
     * Secondary: allow early preview detection (optional)
     * NO timeout for lack of preview
     */
    if (isSetup && !isDevServer) {
        console.log("[SETUP MODE] Command detected as setup/installation. Waiting for completion...");
        const first = await Promise.race([
            /*
             * Normal command completion
             */
            commandPromise.then((result) => ({
                kind: "commandCompleted",
                ...result,
            })),
            /*
             * Optional early preview detection
             *
             * This handles the Vite auto-start case.
             * We only return here if preview actually becomes READY.
             */
            (async () => {
                while (true) {
                    const state = session.preview.state;
                    if (state === "READY") {
                        const hostPort = session.preview.hostPort;
                        if (hostPort) {
                            console.log("[SETUP MODE] Preview detected during setup. Transitioning to preview handling.");
                            markCommandDetached(session);
                            return {
                                kind: "previewReady",
                                hostPort,
                            };
                        }
                    }
                    if (state === "ERROR") {
                        return {
                            kind: "previewFailed",
                            reason: "Preview verification failed during setup command.",
                        };
                    }
                    if (state === "STOPPED") {
                        return {
                            kind: "previewStopped",
                            reason: "Development server stopped during setup command.",
                        };
                    }
                    /*
                     * Continue polling.
                     * Command promise will likely resolve first.
                     */
                    await new Promise((resolve) => setTimeout(resolve, 500));
                }
            })(),
        ]);
        return first;
    }
    /*
     * MODE 2: DEVELOPMENT SERVER COMMAND
     *
     * Race command completion with preview detection.
     * Timeout applies for preview.
     */
    console.log("[DEV SERVER MODE] Command detected as development server. Waiting for preview or completion...");
    const previewPromise = waitForSessionPreview(session);
    const first = await Promise.race([
        /*
         * Normal command completion
         */
        commandPromise.then((result) => ({
            kind: "commandCompleted",
            ...result,
        })),
        /*
         * Preview detection with timeout
         */
        previewPromise,
    ]);
    /*
     * Command finished first
     */
    if (first.kind ===
        "commandCompleted") {
        return first;
    }
    /*
     * Preview was detected.
     *
     * Mark command as detached since the dev server
     * is intentionally long-running.
     */
    markCommandDetached(session);
    console.log("[DEV SERVER MODE] Preview state detected. Command detached from workflow wait.");
    return first;
}
/* ============================================================
   OBSERVATION BUILDER
   ============================================================ */
function observationFromOutcome(outcome) {
    switch (outcome.kind) {
        case "commandCompleted": {
            console.log("===== OBSERVATION =====");
            console.log(outcome.stdout);
            console.log("Success:", outcome.success);
            console.log("=======================");
            return outcome.stdout;
        }
        case "previewReady": {
            console.log("===== PREVIEW VERIFIED =====");
            console.log("Status: READY");
            console.log("Host port:", outcome.hostPort);
            console.log("============================");
            return `
The development server is running and the preview has been verified.

Preview verification:
- Status: READY
- Host port: ${outcome.hostPort}
- HTTP preview check: PASSED

The preview was detected and verified by AI Forge.

The project preview is now available.

Decide whether setup is complete.
`;
        }
        case "previewFailed": {
            console.error("===== PREVIEW FAILED =====");
            console.error(outcome.reason);
            console.error("===========================");
            return `
=== AI FORGE PREVIEW RECOVERY ===

A development server appears to have started, but the AI Forge preview could not be verified.

Reason:
${outcome.reason}

IMPORTANT:
The project workspace already exists.

DO NOT:
- recreate the project
- run the project creation command again
- unnecessarily reinstall the project

The development server may have started automatically as a side effect of the project creation/install process.

If the development server is currently running but the preview is unreachable, it may be bound only to localhost inside the Docker container.

You must recover the running development server.

RECOVERY PROCEDURE:

1. Determine the framework from the existing project/package.json.
2. If a development server is currently running, stop it FIRST using Ctrl+C.
3. Wait for the shell prompt to return.
4. Restart the development server with the correct external host binding.
5. Wait for AI Forge preview verification.
6. Do not finish until preview verification succeeds.

For Vite:

npm run dev -- --host 0.0.0.0

For Next.js:

npm run dev -- --hostname 0.0.0.0

Do not blindly use Vite flags for Next.js or Next.js flags for Vite.

IMPORTANT:
Do not send Ctrl+C and immediately start another command.

First:

{
  "tool": "sendInput",
  "input": "\\u0003"
}

Then wait for the shell to return.

Only after the shell is available should you execute the corrected development-server command.

Preview is NOT considered successful merely because the terminal prints "ready in".

The setup is complete only after AI Forge reports:

PREVIEW VERIFIED
`;
        }
        case "previewStopped": {
            return `
=== AI FORGE PREVIEW STOPPED ===

The development server stopped before the preview became ready.

The existing project workspace must be preserved.

Do NOT recreate the project.

Determine whether the development server needs to be restarted.

For Vite:

npm run dev -- --host 0.0.0.0

For Next.js:

npm run dev -- --hostname 0.0.0.0

Wait for AI Forge to report PREVIEW READY before finishing.
`;
        }
    }
}
/* ============================================================
   SESSION RECOVERY
   ============================================================ */
const RECOVERY_PROBE_COMMAND = 'echo "--PACKAGE_JSON--" ; cat package.json 2>/dev/null || echo "(no package.json)" ; echo "--NODE_MODULES--" ; test -d node_modules && echo present || echo absent ; echo "--FILES--" ; ls -la';
async function getOrRecreateSession(projectId) {
    const existing = sessions.get(projectId);
    if (existing) {
        return {
            session: existing,
            isRecovery: false,
        };
    }
    console.log(`No live session for project ${projectId}. Recreating from persisted state.`);
    const project = await prisma.project.findUnique({
        where: {
            id: projectId,
        },
    });
    if (!project) {
        throw new NonRetriableError(`Project ${projectId} no longer exists. Cannot recover setup.`);
    }
    if (!project.containerId) {
        throw new NonRetriableError(`Project ${projectId} has no containerId. Cannot recreate its session.`);
    }
    if (project.setupAttempts >=
        MAX_RECOVERY_ATTEMPTS) {
        throw new NonRetriableError(`Project ${projectId} exceeded ${MAX_RECOVERY_ATTEMPTS} session-recovery attempts. Giving up.`);
    }
    await prisma.project.update({
        where: {
            id: projectId,
        },
        data: {
            setupAttempts: {
                increment: 1,
            },
        },
    });
    /*
     * Reuse the SAME container and workspace.
     */
    const container = await ensureContainerRunning(project.containerId);
    /*
     * Recreate the in-memory session.
     */
    const session = await createSession(project, getIO());
    /*
     * Inspect current workspace.
     */
    const workspaceProbe = await executeCommand(session, RECOVERY_PROBE_COMMAND);
    const containerInfo = await container.inspect();
    /*
     * We don't guess that a known port means
     * the application is correct.
     *
     * This is only a recovery diagnostic.
     */
    const knownPorts = [
        "3000",
        "3001",
        "5173",
        "8000",
    ];
    let devServerHostPort = null;
    for (const port of knownPorts) {
        const hostPort = containerInfo
            .NetworkSettings
            .Ports[`${port}/tcp`]?.[0]?.HostPort;
        if (!hostPort) {
            continue;
        }
        /*
         * We intentionally do not import or
         * duplicate preview-probe logic here.
         *
         * A live response is only recovery context.
         */
        try {
            const response = await fetch(`http://127.0.0.1:${hostPort}`, {
                signal: AbortSignal.timeout(3000),
            });
            if (response.ok) {
                devServerHostPort =
                    hostPort;
                break;
            }
        }
        catch {
            /*
             * Not reachable.
             */
        }
    }
    const recoveryObservation = `
=== AI FORGE RECOVERY RUN ===

The previous backend/session was lost.

The Docker container and workspace may still contain work from the previous setup attempt.

Container state:
${containerInfo.State.Running
        ? "RUNNING"
        : "STOPPED"}

Development server state:
${devServerHostPort
        ? `An HTTP response was detected on host port ${devServerHostPort}. A development server may already be running.`
        : "No HTTP response detected on known container ports: 3000, 3001, 5173, 8000."}

Workspace inspection:
${workspaceProbe.stdout}

Previous durable setup status:
${project.setupStatus}

Previous error:
${project.setupError ??
        "(none)"}

IMPORTANT RECOVERY RULES:

- The project workspace already exists.
- Do NOT recreate the project.
- Do NOT rerun project creation unless inspection proves that creation actually failed.
- Inspect the current workspace before acting.
- Determine the framework from the actual project files.
- Determine whether dependencies exist.
- Determine whether a development server is running.
- Determine whether preview is externally reachable.

If a development server is running but preview is not externally reachable:

1. Stop the existing development server with Ctrl+C.
2. Wait for the shell prompt.
3. Restart it with the correct external host binding.
4. Wait for preview verification.

For Vite:

npm run dev -- --host 0.0.0.0

For Next.js:

npm run dev -- --hostname 0.0.0.0

Do not finish until preview is verified.
`;
    return {
        session,
        isRecovery: true,
        recoveryObservation,
    };
}
/* ============================================================
   INNGEST WORKFLOW
   ============================================================ */
export const setupWorkflow = inngest.createFunction({
    id: "setup-workflow",
    retries: 2,
    triggers: [
        {
            event: "project/setup.requested",
        },
    ],
    onFailure: async ({ event, error, }) => {
        const originalEvent = event.data.event;
        const projectId = originalEvent
            ?.data
            ?.projectId;
        if (!projectId) {
            console.error("setup-workflow onFailure: could not determine projectId from failure event.", event);
            return;
        }
        await prisma.project.update({
            where: {
                id: projectId,
            },
            data: {
                setupStatus: "FAILED",
                setupError: error?.message ??
                    "Setup failed after all retries.",
            },
        });
    },
}, async ({ event, step, }) => {
    const { projectId, prompt, } = event.data;
    /* ========================================================
       MARK SETUP IN PROGRESS
       ======================================================== */
    await step.run("mark-in-progress", async () => {
        const existing = await prisma.project.findUnique({
            where: {
                id: projectId,
            },
            select: {
                setupAttempts: true,
            },
        });
        await prisma.project.update({
            where: {
                id: projectId,
            },
            data: {
                setupStatus: "IN_PROGRESS",
                setupError: null,
                ...(existing?.setupAttempts ===
                    null
                    ? {
                        setupAttempts: 0,
                    }
                    : {}),
            },
        });
    });
    /* ========================================================
       MAIN SETUP
       ======================================================== */
    const result = await step.run("setup-project", async () => {
        console.log(`Starting setup workflow for project ${projectId}`);
        const { session, isRecovery, recoveryObservation, } = await getOrRecreateSession(projectId);
        console.log("Current sessions:", [
            ...sessions.keys(),
        ]);
        /*
         * Initial Claude decision.
         */
        let action = await setupAgent({
            projectId,
            prompt,
            observation: isRecovery
                ? recoveryObservation
                : undefined,
        });
        let iterations = 0;
        /*
         * Track the last executed command so we can
         * pass it to waitForCommandOrPreview after
         * sendInput operations.
         */
        let lastCommand = null;
        while (action.tool !==
            "finish") {
            iterations++;
            if (iterations >
                MAX_ITERATIONS) {
                throw new Error(`Setup agent exceeded ${MAX_ITERATIONS} iterations without finishing. Aborting.`);
            }
            /* ==================================================
               EXECUTE COMMAND
               ================================================== */
            if (action.tool ===
                "executeCommand") {
                console.log("===== EXECUTE COMMAND =====");
                console.log(action.command);
                console.log("===========================");
                /*
                 * Store the command for potential sendInput
                 * operations that follow.
                 */
                lastCommand = action.command;
                const commandPromise = executeCommand(session, action.command);
                const outcome = await waitForCommandOrPreview(session, commandPromise, action.command);
                action =
                    await setupAgent({
                        projectId,
                        prompt,
                        observation: observationFromOutcome(outcome),
                    });
                continue;
            }
            /* ==================================================
               SEND INPUT
               ================================================== */
            if (action.tool ===
                "sendInput") {
                console.log("===== SEND INPUT =====");
                console.log("Input:", JSON.stringify(action.input));
                console.log("======================");
                /* ==================================================
                   CTRL+C
                   ================================================== */
                if (isCtrlCInput(action.input)) {
                    console.log("Ctrl+C detected.");
                    sendInput(session, action.input);
                    console.log("Ctrl+C sent. Waiting for server to stop...");
                    const start = Date.now();
                    while (Date.now() -
                        start <
                        CTRL_C_TIMEOUT) {
                        if (session.preview
                            .state ===
                            "STOPPED") {
                            break;
                        }
                        if (session.preview
                            .state ===
                            "IDLE") {
                            break;
                        }
                        await new Promise((resolve) => setTimeout(resolve, 200));
                    }
                    /*
                     * Reset stale preview state.
                     *
                     * This allows the corrected server
                     * to begin a fresh preview cycle.
                     */
                    if (session.preview
                        .state ===
                        "STOPPED" ||
                        session.preview
                            .state ===
                            "ERROR") {
                        session.preview.state =
                            "IDLE";
                        session.preview.hostPort =
                            undefined;
                    }
                    action =
                        await setupAgent({
                            projectId,
                            prompt,
                            observation: `
Development server was stopped with Ctrl+C.

The previous development server is no longer running.
The shell is available again.

The existing project files and dependencies remain in the workspace.

Determine the framework from the existing project.

For Vite, start:

npm run dev -- --host 0.0.0.0

For Next.js, start:

npm run dev -- --hostname 0.0.0.0

Do not recreate the project.
Do not unnecessarily reinstall dependencies.

Wait for AI Forge to report PREVIEW READY before finishing.
`,
                        });
                    continue;
                }
                /* ==================================================
                   NORMAL INTERACTIVE INPUT
                   ================================================== */
                sendInput(session, action.input);
                console.log("Input sent. Waiting for command result or preview...");
                const outcome = await waitForCommandOrPreview(session, waitForCommandResult(session), lastCommand || "");
                action =
                    await setupAgent({
                        projectId,
                        prompt,
                        observation: observationFromOutcome(outcome),
                    });
                continue;
            }
            throw new Error(`Unknown agent action: ${JSON.stringify(action)}`);
        }
        /* ====================================================
           SETUP FINISHED
           ==================================================== */
        console.log("===== SETUP FINISHED =====");
        console.log(action.reason);
        /*
         * IMPORTANT:
         *
         * Claude is only allowed to finish after
         * receiving PREVIEW READY.
         *
         * We still enforce that here so the DB
         * cannot accidentally say READY when
         * no preview exists.
         */
        const previewReady = session.preview
            .state ===
            "READY";
        if (!previewReady) {
            throw new Error("Agent finished setup without a verified preview.");
        }
        return {
            success: true,
            reason: action.reason,
            previewReady: true,
            hostPort: session.preview
                .hostPort,
        };
    });
    /* ========================================================
       RECORD FINAL RESULT
       ======================================================== */
    await step.run("record-setup-outcome", async () => {
        await prisma.project.update({
            where: {
                id: projectId,
            },
            data: {
                setupStatus: result.previewReady
                    ? "READY"
                    : "FAILED",
                setupError: result.previewReady
                    ? null
                    : "Agent finished setup without a verified preview.",
            },
        });
    });
    return result;
});
//# sourceMappingURL=setup.workflow.js.map