    
import { io } from "socket.io-client"

const socket = io("process.env.VITE_API_URL");

export default socket
