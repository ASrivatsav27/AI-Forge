import "dotenv/config";
import app from "./src/app.js";
import {Server,Socket} from "socket.io"
import { createServer } from "http"
import * as pty from "node-pty"
import * as os from "os"
import docker from "./src/config/docker.js";
import { prisma } from "./src/config/db.js"
import chokidar from "chokidar"
import { generateFileTree } from "./src/utils/fileTree.js";

const server = createServer(app)
const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"],         
        allowedHeaders: ["my-custom-header"], 
    }
})



io.on("connection", (socket: Socket) => {
    console.log("User connected", socket.id);

    socket.on("terminal:connect", async ({ projectId }) => {
        const project = await prisma.project.findUnique({
            where: {
                id: projectId,
            },
        });

        if (!project)
            return;

        const ptyProcess = pty.spawn("docker",["exec", "-it", project.containerId!, "/bin/sh"],{
                name: "xterm-color",
                cols: 80,
                rows: 30,
                cwd: process.cwd(),
                env: process.env,
        });

        socket.data.pty = ptyProcess;

        ptyProcess.onData((data) => {
            socket.emit("terminal:data", data);
        });

        const container = docker.getContainer(project.containerId!);
        const info = await container.inspect();

        socket.emit("ports:update", info.NetworkSettings.Ports);

        const watcher = chokidar.watch(project.workspacePath, {
            ignoreInitial: true,
            ignored: /(node_modules|\.git)/,
        });

        socket.data.watcher = watcher;

        watcher.on("all", async () => {
            try {
                const fileTree = await generateFileTree(project.workspacePath);
                socket.emit("filetree:update", fileTree);
            } catch (err) {
                console.error("filetree error:", err);
            }
        });
    });
   
    socket.on("terminal:write", (data) => {
        socket.data.pty?.write(data);
    });

    socket.on("terminal:resize", ({ cols, rows }) => {
        socket.data.pty?.resize(cols, rows);
    });

    socket.on("disconnect", () => {
        socket.data.watcher?.close();
        socket.data.pty?.kill();

        console.log("User disconnected", socket.id);
    });
});

server.listen(8000, () => {
    console.log("Server is running on port 8000")
})