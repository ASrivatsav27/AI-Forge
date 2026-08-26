import type { Server } from "socket.io";
import type { Project } from "@prisma/client";
import type { ProjectSession } from "../types/session.js";
import type { ClientToServerEvents, ServerToClientEvents } from "../types/file.js";
export declare function createSession(project: Project, io: Server<ClientToServerEvents, ServerToClientEvents>): Promise<ProjectSession>;
export declare function getPreviewState(session: ProjectSession): {
    state: ProjectSession["preview"]["state"];
    hostPort: string | undefined;
};
export declare function waitForPreviewState(session: ProjectSession, timeout?: number): Promise<{
    state: ProjectSession["preview"]["state"];
    hostPort: string | undefined;
}>;
//# sourceMappingURL=createSession.d.ts.map