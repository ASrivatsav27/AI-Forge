import "dotenv/config";
import app from "./src/app.js";
import {Server,Socket} from "socket.io"
import { createServer } from "http"
import * as pty from "node-pty"
import * as os from "os"
import docker from "./src/config/docker.js";
import { prisma } from "./src/config/db.js"

const server = createServer(app)
const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"],         
        allowedHeaders: ["my-custom-header"], 
    }
})





io.on("connection", (socket: Socket) => {
    console.log("User connected", socket.id)
    
    socket.on("connect", ({}) => {

    })

     
    socket.on("terminal:write", (data) => {
        ptyProcess.write(data)
    })
    

    ptyProcess.onData((data) => {
          socket.emit("terminal:data",data)
    
    })
   
    

    socket.on("disconnect", () => {
        console.log("User disconnected",socket.id)
    })

})

server.listen(8000, () => {
    console.log("Server is running on port 8000")
})