import * as pty from "node-pty";
import chokidar from "chokidar";
import docker from "../config/docker.js";
import { generateFileTree } from "../utils/fileTree.js";
import { waitForPreview } from "../services/previewProbe.js";
import { sessions } from "./session.manager.js";
const STOP_SIGNAL_PATTERN = /\^C/;
/*
 * We still use "ready in" as a signal that the
 * development server is probably starting.
 *
 * BUT we do NOT immediately extract the port.
 *
 * The actual URL/port may arrive in a later PTY chunk.
 */
const READY_SIGNAL_PATTERN = /ready in/i;
/* ============================================================
   CREATE SESSION
   ============================================================ */
export async function createSession(project, io) {
    const projectId = project.id;
    const ptyProcess = pty.spawn("docker", [
        "exec",
        "-it",
        project.containerId,
        "/bin/sh",
    ], {
        name: "xterm-color",
        cols: 80,
        rows: 30,
        cwd: process.cwd(),
        env: process.env,
    });
    const watcher = chokidar.watch(project.workspacePath, {
        ignoreInitial: true,
        ignored: /(node_modules|\.git)/,
    });
    const session = {
        projectId,
        pty: ptyProcess,
        watcher,
        clients: new Set(),
        workspacePath: project.workspacePath,
        containerId: project.containerId,
        preview: {
            state: "IDLE",
            hostPort: undefined,
        },
    };
    const currentSession = session;
    /*
     * This buffer belongs ONLY to preview detection.
     *
     * It accumulates PTY output until we have enough
     * information to identify the actual application port.
     */
    let terminalBuffer = "";
    /*
     * Prevent multiple concurrent preview detection
     * operations from running at the same time.
     */
    let previewDetectionRunning = false;
    /* ==========================================================
       PTY OUTPUT
       ========================================================== */
    ptyProcess.onData(async (data) => {
        /*
         * Always forward raw terminal output.
         */
        io.to(projectId).emit("terminal:data", data);
        /*
         * Add output to preview buffer.
         */
        terminalBuffer += data;
        /*
         * Keep the buffer bounded.
         */
        if (terminalBuffer.length >
            20000) {
            terminalBuffer =
                terminalBuffer.slice(-10000);
        }
        /* ========================================================
           STOP DETECTION
           ======================================================== */
        if ((currentSession.preview
            .state === "READY" ||
            currentSession.preview
                .state === "STARTING") &&
            STOP_SIGNAL_PATTERN.test(terminalBuffer)) {
            currentSession.preview.state =
                "STOPPED";
            currentSession.preview.hostPort =
                undefined;
            previewDetectionRunning =
                false;
            terminalBuffer = "";
            console.log("Preview stopped detected");
            io.to(projectId).emit("preview:stopped");
            return;
        }
        /* ========================================================
           SHOULD WE LOOK FOR A DEV SERVER?
           ======================================================== */
        const canStart = currentSession.preview
            .state === "IDLE" ||
            currentSession.preview
                .state === "STOPPED" ||
            currentSession.preview
                .state === "ERROR";
        if (!canStart ||
            previewDetectionRunning) {
            return;
        }
        /*
         * Don't even attempt preview detection
         * until the terminal has shown a server-ready
         * signal.
         */
        if (!READY_SIGNAL_PATTERN.test(stripAnsi(terminalBuffer))) {
            return;
        }
        /* ========================================================
           TRY TO EXTRACT APPLICATION PORT
           ======================================================== */
        const cleanOutput = stripAnsi(terminalBuffer);
        /*
         * Support common outputs:
         *
         * Vite:
         *   Local: http://localhost:5173/
         *
         * Vite:
         *   ➜ Local: http://localhost:5173/
         *
         * Vite:
         *   Local: http://0.0.0.0:5173/
         *
         * Generic:
         *   http://localhost:3000
         *
         * Generic:
         *   http://0.0.0.0:3000
         */
        const portMatch = cleanOutput.match(/(?:localhost|0\.0\.0\.0):(\d+)/i);
        const containerPort = portMatch?.[1];
        /*
         * IMPORTANT:
         *
         * "ready in" can arrive before the URL.
         *
         * Therefore DO NOT mark ERROR and DO NOT
         * clear terminalBuffer when the port is missing.
         *
         * Wait for the next PTY chunk.
         */
        if (!containerPort) {
            console.log("Dev server ready signal detected, but application port has not arrived yet. Waiting for more PTY output...");
            return;
        }
        console.log("Detected app port:", containerPort);
        /* ========================================================
           PREVIEW DETECTION START
           ======================================================== */
        previewDetectionRunning =
            true;
        currentSession.preview.state =
            "STARTING";
        /*
         * Keep the output because it may still
         * be useful for diagnostics.
         */
        const readyOutput = cleanOutput;
        /*
         * We have successfully extracted the port,
         * so the current preview-detection buffer
         * can now be consumed.
         */
        terminalBuffer = "";
        try {
            /* ======================================================
               DOCKER PORT MAPPING
               ====================================================== */
            const container = docker.getContainer(project.containerId);
            const info = await container.inspect();
            /*
             * A stop may have happened while
             * container.inspect() was awaiting.
             */
            if (currentSession.preview
                .state !== "STARTING") {
                previewDetectionRunning =
                    false;
                return;
            }
            const hostPort = info
                .NetworkSettings
                .Ports[`${containerPort}/tcp`]?.[0]?.HostPort;
            if (!hostPort) {
                console.error(`No Docker host mapping found for container port ${containerPort}.`);
                currentSession.preview.state =
                    "ERROR";
                currentSession.preview.hostPort =
                    undefined;
                previewDetectionRunning =
                    false;
                return;
            }
            console.log("Detected host port:", hostPort);
            /* ======================================================
               HTTP PREVIEW PROBE
               ====================================================== */
            console.log("Waiting for preview...");
            const ready = await waitForPreview(hostPort);
            /*
             * Check whether Ctrl+C / stop happened
             * while the HTTP probe was running.
             */
            if (currentSession.preview
                .state !== "STARTING") {
                previewDetectionRunning =
                    false;
                return;
            }
            if (!ready) {
                console.log("Preview timeout");
                currentSession.preview.state =
                    "ERROR";
                currentSession.preview.hostPort =
                    undefined;
                io.to(projectId).emit("preview:error");
                previewDetectionRunning =
                    false;
                return;
            }
            /* ======================================================
               PREVIEW READY
               ====================================================== */
            console.log("Preview Ready");
            currentSession.preview.state =
                "READY";
            currentSession.preview.hostPort =
                hostPort;
            /*
             * This is the important output the workflow
             * can consume.
             */
            io.to(projectId).emit("preview:ready", hostPort);
            console.log("PREVIEW VERIFIED:", {
                state: currentSession.preview
                    .state,
                containerPort,
                hostPort,
                output: readyOutput,
            });
        }
        catch (error) {
            console.error("Preview detection error:", error);
            /*
             * Don't overwrite STOPPED if Ctrl+C
             * happened while we were waiting.
             */
            if (currentSession.preview
                .state === "STARTING") {
                currentSession.preview.state =
                    "ERROR";
                currentSession.preview.hostPort =
                    undefined;
            }
        }
        finally {
            previewDetectionRunning =
                false;
        }
    });
    /* ============================================================
       FILE WATCHER
       ============================================================ */
    watcher.on("all", async () => {
        try {
            const fileTree = await generateFileTree(project.workspacePath);
            io.to(projectId).emit("filetree:update", fileTree);
        }
        catch (err) {
            console.error("filetree error:", err);
        }
    });
    /* ============================================================
       REGISTER SESSION
       ============================================================ */
    sessions.set(projectId, currentSession);
    return currentSession;
}
/* ============================================================
   PREVIEW STATE ACCESS
   ============================================================ */
/*
 * The workflow should use this instead of implementing
 * its own port detection.
 *
 * createSession is the single source of truth for:
 *
 * - preview state
 * - host port
 */
export function getPreviewState(session) {
    return {
        state: session.preview.state,
        hostPort: session.preview.hostPort,
    };
}
/* ============================================================
   WAIT FOR PREVIEW RESULT
   ============================================================ */
/*
 * This lets setup.workflow.ts wait for the result produced
 * by createSession instead of guessing from terminal output.
 *
 * It does NOT detect ports itself.
 *
 * createSession does that.
 */
export function waitForPreviewState(session, timeout = 60_000) {
    return new Promise((resolve) => {
        const start = Date.now();
        const check = () => {
            const preview = getPreviewState(session);
            /*
             * These are terminal states for this
             * particular preview attempt.
             */
            if (preview.state ===
                "READY" ||
                preview.state ===
                    "ERROR" ||
                preview.state ===
                    "STOPPED") {
                resolve(preview);
                return;
            }
            /*
             * Timeout.
             */
            if (Date.now() - start >=
                timeout) {
                resolve(getPreviewState(session));
                return;
            }
            setTimeout(check, 250);
        };
        check();
    });
}
/* ============================================================
   ANSI STRIPPER
   ============================================================ */
function stripAnsi(text) {
    return text.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, "");
}
//# sourceMappingURL=createSession.js.map