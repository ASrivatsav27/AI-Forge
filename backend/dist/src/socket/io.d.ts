import type { Server } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "../types/file.js";
export declare function setIO(server: Server<ClientToServerEvents, ServerToClientEvents>): void;
export declare function getIO(): Server<ClientToServerEvents, ServerToClientEvents, import("socket.io").DefaultEventsMap, any>;
//# sourceMappingURL=io.d.ts.map