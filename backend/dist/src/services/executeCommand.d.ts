import type { ProjectSession } from "../types/session.js";
export interface CommandResult {
    stdout: string;
    success: boolean;
}
export declare function executeCommand(session: ProjectSession, command: string): Promise<CommandResult>;
export declare function markCommandDetached(session: ProjectSession): void;
export declare function sendInput(session: ProjectSession, input: string): void;
export declare function waitForCommandResult(session: ProjectSession): Promise<CommandResult>;
//# sourceMappingURL=executeCommand.d.ts.map