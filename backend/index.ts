import "dotenv/config";
import app from "./src/app.js";
import {Server,Socket} from "socket.io"
import { createServer } from "http"


const server = createServer(app)
const io = new Server(server)

io.on("connection", (socket: Socket) => {
    console.log("User connected",socket.id)
})

server.listen(8000, () => {
    console.log("Server is running on port 8000")
})