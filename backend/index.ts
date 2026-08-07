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
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) return;
   await ensureContainerRunning(project.containerId!);
    socket.join(projectId);
   
    let session = sessions.get(projectId);

    if (!session) {
      session = await createSession(project, io);
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