import "dotenv/config";
import app from "./src/app.js";
import { Server, Socket } from "socket.io";
import { createServer } from "http";
import * as pty from "node-pty";
import docker from "./src/config/docker.js";
import { prisma } from "./src/config/db.js";
import chokidar from "chokidar";
import { generateFileTree } from "./src/utils/fileTree.js";
import type { ProjectSession } from "./src/types/session.js";
import type { ClientToServerEvents,ServerToClientEvents } from "./src/types/file.js";
import { waitForPreview } from "./src/services/previewProbe.js";
import fs from "fs/promises";
import path from "path";
import { ensureContainerRunning } from "./src/services/docker.service.js";


const server = createServer(app);

const io = new Server<ClientToServerEvents,ServerToClientEvents>(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["my-custom-header"],
  },
});

const sessions = new Map<string, ProjectSession>();

type PreviewState = "IDLE" | "STARTING" | "READY" | "STOPPED" | "ERROR";

const STOP_SIGNAL_PATTERN = /\^C/;
const READY_SIGNAL_PATTERN = /ready in/;

io.on("connection", (socket: Socket) => {
  console.log("User connected", socket.id);

  socket.on("terminal:connect", async ({ projectId }) => {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) return;
   const container = await ensureContainerRunning(project.containerId!);
    socket.join(projectId);
   
    let session = sessions.get(projectId);

    if (!session) {
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

      session = {
        projectId,
        pty: ptyProcess,
        watcher,
        clients: new Set(),
        workspacePath: project.workspacePath,
        containerId:project.containerId!,
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
    }

    session.clients.add(socket.id);

    socket.data.session = session;
    socket.data.projectId = projectId;

    // Reconnect / browser-refresh replay based on current preview state
    if (session.preview.state === "READY" && session.preview.hostPort) {
      socket.emit("preview:ready", session.preview.hostPort);
      console.log("Emitted preview:ready");
    } else if (session.preview.state === "STOPPED") {
      socket.emit("preview:stopped");
    } else if (session.preview.state === "ERROR") {
      socket.emit("preview:error");
    }
  });

  socket.on("terminal:write", (data) => {
    socket.data.session?.pty.write(data);
  });

  socket.on("terminal:resize", ({ cols, rows }) => {
    try {
      socket.data.session?.pty.resize(cols, rows);
    } catch {
      console.warn("PTY already exited, ignoring resize");
    }
  });
  socket.on("file:create", async ({ relativePath, content = "" }) => {
  const session = socket.data.session;
  if (!session) return;

  const filePath = path.join(session.workspacePath, relativePath);

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content);
});

socket.on("folder:create", async ({ relativePath }) => {
  const session = socket.data.session;
  if (!session) return;

  const folderPath = path.join(session.workspacePath, relativePath);

  await fs.mkdir(folderPath, { recursive: true });
});
  socket.on("fs:delete", async ({ relativePath }) => {
  const session = socket.data.session;
  if (!session) return;

  const targetPath = path.join(session.workspacePath, relativePath);

  const stats = await fs.stat(targetPath);

  if (stats.isDirectory()) {
    await fs.rm(targetPath, {
      recursive: true,
      force: true,
    });
  } else {
    await fs.unlink(targetPath);
  }
});
  

   socket.on("file:read", async ({ relativePath }) => {
  const session = socket.data.session;
  if (!session) return;

  const filePath = path.join(session.workspacePath, relativePath);

  const content = await fs.readFile(filePath, "utf8");

  socket.emit("file:content", {
    relativePath,
    content,
  });
});



  
  
  socket.on("file:save", async ({ relativePath, content }) => {
    const session = socket.data.session
    if (!session) return
    const filePath = path.join(session.workspacePath, relativePath)
     if ( !filePath.startsWith(path.resolve(session.workspacePath))) {
        return;
    }
    await fs.writeFile(filePath, content);
  })

  
  socket.on("terminal:disconnect", async ({ projectId }) => {
    const session = socket.data.session;

    if (!session) return;

    session.clients.delete(socket.id);

    if (session.clients.size === 0) {
      session.watcher.close();
      session.pty.kill();
          const container = docker.getContainer(session.containerId);
    await container.stop();
      sessions.delete(projectId);
    }

    socket.leave(projectId);

    console.log(`Terminal closed for project ${projectId}`);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected", socket.id);
  });
});

server.listen(8000, () => {
  console.log("Server is running on port 8000");
});