import { emitEvent } from "../services/runtime-events.js";
import * as pty from "node-pty";
import chokidar from "chokidar";
import type { Server } from "socket.io";
import type { Project } from "@prisma/client";
import docker from "../config/docker.js";
import { generateFileTree } from "../utils/fileTree.js";
import { waitForPreview } from "../services/previewProbe.js";
import type { ProjectSession } from "../types/session.js";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "../types/file.js";
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

export async function createSession(
  project: Project,
  io: Server<
    ClientToServerEvents,
    ServerToClientEvents
  >
): Promise<ProjectSession> {
  const projectId = project.id;

  const ptyProcess = pty.spawn(
    "docker",
    [
      "exec",
      "-it",
      project.containerId!,
      "/bin/sh",
    ],
    {
      name: "xterm-color",
      cols: 80,
      rows: 30,
      cwd: process.cwd(),
      env: process.env,
    }
  );

  const watcher = chokidar.watch(
    project.workspacePath,
    {
      ignoreInitial: true,
      /*
       * .next, dist, and build are generated output / dev-server scratch
       * space, not source the file tree needs to reflect — same category
       * as node_modules and .git. This also sharply reduces exposure to
       * EPERM races on transient files the Next.js dev server creates and
       * deletes almost immediately (e.g. .next/dev/tmp_file_io_benchmark_*),
       * which chokidar can lose the race to open a watch handle on.
       */
      ignored: /(node_modules|\.git|\.next|dist|build)/,
    }
  );

  const session: ProjectSession = {
    projectId,
    pty: ptyProcess,
    watcher,
    clients: new Set(),
    workspacePath: project.workspacePath,
    containerId: project.containerId!,
    preview: {
      state: "IDLE",
      hostPort: undefined,
    },
    stopRequested: false,
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

  ptyProcess.onData(
    async (data) => {
      /*
       * Always forward raw terminal output.
       */
      io.to(projectId).emit(
        "terminal:data",
        data
      );

      /*
       * Add output to preview buffer.
       */
      terminalBuffer += data;

      /*
       * Keep the buffer bounded.
       */
      if (
        terminalBuffer.length >
        20000
      ) {
        terminalBuffer =
          terminalBuffer.slice(
            -10000
          );
      }

      /* ========================================================
         STOP DETECTION
         ======================================================== */

      if (
        currentSession.stopRequested &&
        (
          currentSession.preview
            .state === "READY" ||
          currentSession.preview
            .state === "STARTING"
        ) &&
        STOP_SIGNAL_PATTERN.test(
          terminalBuffer
        )
      ) {
        /*
         * Consume the stop request. Without this, a stray `^C`-shaped
         * sequence appearing later (e.g. in real compiler output, or
         * a delayed echo) could fire STOP DETECTION again for an
         * attempt that was never actually asked to stop.
         */
        currentSession.stopRequested =
          false;

        currentSession.preview.state =
          "STOPPED";

        currentSession.preview.hostPort =
          undefined;

        previewDetectionRunning =
          false;

        terminalBuffer = "";

        console.log(
          "Preview stopped detected"
        );

        /*
         * Socket event for the UI.
         */
        io.to(projectId).emit(
          "preview:stopped"
        );

        /*
         * Runtime event for the workflow.
         *
         * This is important because nextEvent(session)
         * must be able to observe preview lifecycle changes.
         */
        emitEvent(currentSession, {
          kind: "previewStopped",
        });

        return;
      }

      /* ========================================================
         SHOULD WE LOOK FOR A DEV SERVER?
         ======================================================== */

      const canStart =
        currentSession.preview
          .state === "IDLE" ||
        currentSession.preview
          .state === "STOPPED" ||
        currentSession.preview
          .state === "ERROR";

      if (
        !canStart ||
        previewDetectionRunning
      ) {
        return;
      }

      /*
       * Don't even attempt preview detection
       * until the terminal has shown a server-ready
       * signal.
       */
      if (
        !READY_SIGNAL_PATTERN.test(
          stripAnsi(
            terminalBuffer
          )
        )
      ) {
        return;
      }

      /* ========================================================
         TRY TO EXTRACT APPLICATION PORT
         ======================================================== */

      const cleanOutput =
        stripAnsi(
          terminalBuffer
        );

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
      const portMatch =
        cleanOutput.match(
          /(?:localhost|0\.0\.0\.0):(\d+)/i
        );

      const containerPort =
        portMatch?.[1];

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
        console.log(
          "Dev server ready signal detected, but application port has not arrived yet. Waiting for more PTY output..."
        );

        return;
      }

      console.log(
        "Detected app port:",
        containerPort
      );

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
      const readyOutput =
        cleanOutput;

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

        const container =
          docker.getContainer(
            project.containerId!
          );

        const info =
          await container.inspect();

        /*
         * A stop may have happened while
         * container.inspect() was awaiting.
         */
        if (
          currentSession.preview
            .state !== "STARTING"
        ) {
          previewDetectionRunning =
            false;

          return;
        }

        const hostPort =
          info
            .NetworkSettings
            .Ports[
              `${containerPort}/tcp`
            ]?.[0]?.HostPort;

        if (!hostPort) {
          const reason =
            `No Docker host mapping found for container port ${containerPort}.`;

          console.error(reason);

          currentSession.preview.state =
            "ERROR";

          currentSession.preview.hostPort =
            undefined;

          /*
           * Runtime event for the workflow.
           */
          emitEvent(currentSession, {
            kind: "previewError",
            reason,
          });

          previewDetectionRunning =
            false;

          return;
        }

        console.log(
          "Detected host port:",
          hostPort
        );

        /* ======================================================
           HTTP PREVIEW PROBE
           ====================================================== */

        console.log(
          "Waiting for preview..."
        );

        /*
         * FIX: waitForPreview now returns
         *   { ready: true } | { ready: false; reason: string }
         * instead of a plain boolean. An object is ALWAYS truthy
         * in JS, so the old `if (!ready)` check could never fire —
         * every call fell through to the READY branch regardless
         * of what actually happened, including a genuine compile
         * error or a full timeout.
         *
         * Destructure the real shape and use the REAL captured
         * reason (the actual Next.js error body surfaced by
         * previewProbe.ts), not a generic placeholder string.
         */
        const preview =
          await waitForPreview(
            hostPort
          );

        /*
         * Check whether Ctrl+C / stop happened
         * while the HTTP probe was running.
         */
        if (
          currentSession.preview
            .state !== "STARTING"
        ) {
          previewDetectionRunning =
            false;

          return;
        }

        if (!preview.ready) {
          const reason = preview.reason;

          console.log(
            "Preview failed:",
            reason
          );

          currentSession.preview.state =
            "ERROR";

          currentSession.preview.hostPort =
            undefined;

          /*
           * Socket event for the UI.
           */
          io.to(projectId).emit(
            "preview:error"
          );

          /*
           * Runtime event for the workflow.
           *
           * Without this, nextEvent(session)
           * would wait forever after a failed preview.
           *
           * `reason` now carries the ACTUAL captured error body
           * from previewProbe.ts (e.g. the Next.js compile error
           * with the broken file's path and line number), not a
           * generic "verification timed out" placeholder. This is
           * what lets extractErrorFilePath() in coding.agent.ts
           * actually find the broken file instead of always
           * falling back to "last written".
           */
          emitEvent(currentSession, {
            kind: "previewError",
            reason,
          });

          previewDetectionRunning =
            false;

          return;
        }

        /* ======================================================
           PREVIEW READY
           ====================================================== */

        console.log(
          "Preview Ready"
        );

        currentSession.preview.state =
          "READY";

        currentSession.preview.hostPort =
          hostPort;

        /*
         * ======================================================
         * IMPORTANT:
         *
         * This is the event that was missing.
         *
         * The workflow is waiting here:
         *
         *   const evt = await nextEvent(session);
         *
         * nextEvent() can only resolve when something calls
         * emitEvent(). Previously we only emitted the Socket.IO
         * "preview:ready" event, which the workflow does not
         * consume.
         *
         * Now the preview runtime reports the factual event
         * through the same runtime event queue used by PTY
         * command events.
         * ======================================================
         */
        emitEvent(currentSession, {
          kind: "previewReady",
          hostPort,
        });

        /*
         * Socket event for the UI.
         */
        io.to(projectId).emit(
          "preview:ready",
          hostPort
        );

        console.log(
          "PREVIEW VERIFIED:",
          {
            state:
              currentSession.preview
                .state,
            containerPort,
            hostPort,
            output:
              readyOutput,
          }
        );
      } catch (error) {
        console.error(
          "Preview detection error:",
          error
        );

        /*
         * Don't overwrite STOPPED if Ctrl+C
         * happened while we were waiting.
         */
        if (
          currentSession.preview
            .state === "STARTING"
        ) {
          currentSession.preview.state =
            "ERROR";

          currentSession.preview.hostPort =
            undefined;

          const reason =
            error instanceof Error
              ? error.message
              : String(error);

          /*
           * Runtime event for the workflow.
           */
          emitEvent(currentSession, {
            kind: "previewError",
            reason,
          });
        }
      } finally {
        previewDetectionRunning =
          false;
      }
    }
  );

  /* ============================================================
     FILE WATCHER
     ============================================================ */

  watcher.on(
    "all",
    async () => {
      try {
        const fileTree =
          await generateFileTree(
            project.workspacePath
          );

        io.to(projectId).emit(
          "filetree:update",
          fileTree
        );
      } catch (err) {
        console.error(
          "filetree error:",
          err
        );
      }
    }
  );

  /*
   * MANDATORY: chokidar's FSWatcher is an EventEmitter. If it emits
   * "error" with no listener attached, Node treats it as an uncaught
   * exception and crashes the ENTIRE process — not just this session,
   * every active project/session on the backend goes down with it.
   *
   * This has already happened in practice: an EPERM trying to watch a
   * transient Next.js dev-server scratch file
   * (.next/dev/tmp_file_io_benchmark_*) with no listener here took the
   * whole backend down. A watch failure on one path should degrade
   * gracefully (that path's changes just won't show up in the file
   * tree) — it must never be allowed to kill the process.
   */
  watcher.on(
    "error",
    (err) => {
      console.error(
        `Workspace watcher error for project ${projectId}:`,
        err
      );
    }
  );

  /* ============================================================
     REGISTER SESSION
     ============================================================ */

  sessions.set(
    projectId,
    currentSession
  );

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
export function getPreviewState(
  session: ProjectSession
): {
  state: ProjectSession["preview"]["state"];
  hostPort:
    | string
    | undefined;
} {
  return {
    state:
      session.preview.state,
    hostPort:
      session.preview.hostPort,
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
export function waitForPreviewState(
  session: ProjectSession,
  timeout = 60_000
): Promise<{
  state: ProjectSession["preview"]["state"];
  hostPort:
    | string
    | undefined;
}> {
  return new Promise(
    (resolve) => {
      const start =
        Date.now();

      const check = () => {
        const preview =
          getPreviewState(
            session
          );

        /*
         * These are terminal states for this
         * particular preview attempt.
         */
        if (
          preview.state ===
            "READY" ||
          preview.state ===
            "ERROR" ||
          preview.state ===
            "STOPPED"
        ) {
          resolve(
            preview
          );

          return;
        }

        /*
         * Timeout.
         */
        if (
          Date.now() - start >=
          timeout
        ) {
          resolve(
            getPreviewState(
              session
            )
          );

          return;
        }

        setTimeout(
          check,
          250
        );
      };

      check();
    }
  );
}

/* ============================================================
   ANSI STRIPPER
   ============================================================ */

function stripAnsi(
  text: string
): string {
  return text.replace(
    /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g,
    ""
  );
}