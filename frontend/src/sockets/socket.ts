    
import { io } from "socket.io-client"

const socket = io(
  process.env.VITE_SOCKET_URL || "http://localhost:8000",
  { withCredentials: true }
);

export default socket
