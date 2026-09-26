import "dotenv/config";
import app from "./src/app.js";
import { Server, Socket } from "socket.io";
import { createServer } from "http";
import docker from "./src/config/docker.js";
import { prisma } from "./src/config/db.js";
import type { ProjectSession } from "./src/types/session.js";
import type { ClientToServerEvents,ServerToClientEvents } from "./src/types/file.js";
import fs from "fs/promises";
import path from "path";
import { ensureContainerRunning } from "./src/services/docker.service.js";
import { sessions } from "./src/session/session.manager.js";
import { createSession } from "./src/session/createSession.js";
import { setIO } from "./src/socket/io.js";
import { generateFileTree } from "./src/utils/fileTree.js";

const server = createServer(app);

const io = new Server<ClientToServerEvents,ServerToClientEvents>(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["my-custom-header"],
  },
});

setIO(io);

io.on("connection", (socket: Socket) => {
  console.log("User connected", socket.id);

  socket.on("terminal:connect", async ({ projectId }) => {
    try {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });

      if (!project) {
        console.error(`terminal:connect: no project found for ${projectId}`);
        return;
      }

      await ensureContainerRunning(project.containerId!);
      socket.join(projectId);

      let session = sessions.get(projectId);

      if (!session) {
        session = await createSession(project, io);
      }

      session.clients.add(socket.id);

      socket.data.session = session;
      socket.data.projectId = projectId;

      // Send the current file tree immediately to this client so the
      // Explorer is populated on connect without waiting for a file
      // change to trigger chokidar (which uses ignoreInitial: true).
      // Safe on Windows direct: workspacePath is always correct there.
      try {
        const currentTree = await generateFileTree(session.workspacePath);
        socket.emit("filetree:update", currentTree);
      } catch (err) {
        console.error(`Initial filetree emit failed for ${projectId}:`, err);
      }

      // Reconnect / browser-refresh replay based on current preview state
      if (session.preview.state === "READY" && session.preview.hostPort) {
        socket.emit("preview:ready", session.preview.hostPort);
        console.log("Emitted preview:ready");
      } else if (session.preview.state === "STOPPED") {
        socket.emit("preview:stopped");
      } else if (session.preview.state === "ERROR") {
        socket.emit("preview:error");
      }
    } catch (err) {
      console.error(
        `terminal:connect FAILED for project ${projectId}:`,
        err
      );
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

  // Explicit refresh request from the Explorer's Refresh button.
  // Previously this event was emitted by the client but never handled
  // by the server, so clicking Refresh did nothing. Now it re-reads the
  // workspace directory and sends the current tree only to the requesting
  // socket (not broadcast to all clients in the room).
  socket.on("filetree:refresh", async () => {
    const session = socket.data.session;
    if (!session) return;

    try {
      const fileTree = await generateFileTree(session.workspacePath);
      socket.emit("filetree:update", fileTree);
    } catch (err) {
      console.error(`filetree:refresh failed for ${socket.data.projectId}:`, err);
    }
  });

  socket.on("file:create", async ({ relativePath, content = "" }) => {
    const session = socket.data.session;
    if (!session) return;

    const filePath = path.join(session.workspacePath, relativePath);

    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content);
    } catch (err) {
      console.error(`file:create failed for ${relativePath}:`, err);
    }
  });

  socket.on("folder:create", async ({ relativePath }) => {
    const session = socket.data.session;
    if (!session) return;

    const folderPath = path.join(session.workspacePath, relativePath);

    try {
      await fs.mkdir(folderPath, { recursive: true });
    } catch (err) {
      console.error(`folder:create failed for ${relativePath}:`, err);
    }
  });

  socket.on("fs:delete", async ({ relativePath }) => {
    const session = socket.data.session;
    if (!session) return;

    const targetPath = path.join(session.workspacePath, relativePath);

    try {
      const stats = await fs.stat(targetPath);

      if (stats.isDirectory()) {
        await fs.rm(targetPath, {
          recursive: true,
          force: true,
        });
      } else {
        await fs.unlink(targetPath);
      }
    } catch (err: any) {
      if (err?.code === "ENOENT") return; // already gone — fine
      console.error(`fs:delete failed for ${relativePath}:`, err);
    }
  });

  socket.on("file:read", async ({ relativePath }) => {
    const session = socket.data.session;
    if (!session) return;

    const filePath = path.join(session.workspacePath, relativePath);

    try {
      const content = await fs.readFile(filePath, "utf8");

      socket.emit("file:content", {
        relativePath,
        content,
      });
    } catch (err: any) {
      if (err?.code === "ENOENT") {
        socket.emit("file:content", {
          relativePath,
          content: "",
        });
        return;
      }

      console.error(`file:read failed for ${relativePath}:`, err);
    }
  });

  socket.on("file:save", async ({ relativePath, content }) => {
    const session = socket.data.session;
    if (!session) return;

    const filePath = path.join(session.workspacePath, relativePath);

    if (!filePath.startsWith(path.resolve(session.workspacePath))) {
      return;
    }

    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content);
    } catch (err) {
      console.error(`file:save failed for ${relativePath}:`, err);
    }
  });

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
