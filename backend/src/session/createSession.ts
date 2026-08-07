import * as pty from "node-pty";
import chokidar from "chokidar";
import type { Server } from "socket.io";
import type { Project } from "@prisma/client";
import docker from "../config/docker.js";
import { generateFileTree } from "../utils/fileTree.js";
import { waitForPreview } from "../services/previewProbe.js";
import type { ProjectSession } from "../types/session.js";
import type { ClientToServerEvents, ServerToClientEvents } from "../types/file.js";
import { sessions } from "./session.manager.js";

const STOP_SIGNAL_PATTERN = /\^C/;
const READY_SIGNAL_PATTERN = /ready in/;

export async function createSession(
  project: Project,
  io: Server<ClientToServerEvents, ServerToClientEvents>
): Promise<ProjectSession> {
  const projectId = project.id;

  const ptyProcess = pty.spawn(
    "docker",
    ["exec", "-it", project.containerId!, "/bin/sh"],
    {
      name: "xterm-color",
      cols: 80,
      rows: 30,
      cwd: process.cwd(),
      env: process.env,
    }
  );

  const watcher = chokidar.watch(project.workspacePath, {
    ignoreInitial: true,
    ignored: /(node_modules|\.git)/,
  });

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
  };

  const currentSession = session;

  let terminalBuffer = "";

    ptyProcess.onData(async (data) => {
      
    io.to(projectId).emit("terminal:data", data);
    terminalBuffer += data;

    // --- Stop detection: dev server killed (Ctrl+C or equivalent) ---
    if (
      (currentSession.preview.state === "READY" ||
        currentSession.preview.state === "STARTING") &&
      STOP_SIGNAL_PATTERN.test(terminalBuffer)
    ) {
      currentSession.preview.state = "STOPPED";
      currentSession.preview.hostPort = undefined;
      terminalBuffer = "";
      console.log("Preview stopped detected");
      io.to(projectId).emit("preview:stopped");
      return;
    }

    // --- Start detection: dev server printed "ready in" ---
    const canStart =
      currentSession.preview.state === "IDLE" ||
      currentSession.preview.state === "STOPPED" ||
      currentSession.preview.state === "ERROR";

    if (canStart && READY_SIGNAL_PATTERN.test(terminalBuffer)) {
      currentSession.preview.state = "STARTING";
      terminalBuffer = "";

      const container = docker.getContainer(project.containerId!);
      const info = await container.inspect();

      // Bail if a stop happened while we were awaiting this
      if (currentSession.preview.state !== "STARTING") return;

      const vitePort =
        info.NetworkSettings.Ports["5173/tcp"]?.[0]?.HostPort;

      console.log("Detected Vite port:", vitePort);

      if (!vitePort) {
        currentSession.preview.state = "ERROR";
        return;
      }

      console.log("Waiting for preview...");
      const ready = await waitForPreview(vitePort);

      // Bail if a stop happened while we were awaiting this
      if (currentSession.preview.state !== "STARTING") return;

      if (!ready) {
        console.log("Preview timeout");
        currentSession.preview.state = "ERROR";
        return;
      }

      console.log("Preview Ready");
      currentSession.preview.state = "READY";
      currentSession.preview.hostPort = vitePort;

      io.to(projectId).emit("preview:ready", vitePort);
    }

    if (terminalBuffer.length > 10000) {
      terminalBuffer = terminalBuffer.slice(-5000);
    }
  });

  watcher.on("all", async () => {
    try {
      const fileTree = await generateFileTree(project.workspacePath);
      io.to(projectId).emit("filetree:update", fileTree);
    } catch (err) {
      console.error("filetree error:", err);
    }
  });

  sessions.set(projectId, currentSession);

  return currentSession;
}