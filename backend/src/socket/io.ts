import type { Server } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "../types/file.js";

let io: Server<ClientToServerEvents, ServerToClientEvents>;

export function setIO(
  server: Server<ClientToServerEvents, ServerToClientEvents>
) {
  io = server;
}

export function getIO() {
  return io;
}