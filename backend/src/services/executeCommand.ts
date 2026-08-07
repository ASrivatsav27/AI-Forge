import type { ProjectSession } from "../types/session.js";

export interface CommandResult {
  stdout: string;
  success: boolean;
}

export async function executeCommand(
  session: ProjectSession,
  command: string
): Promise<CommandResult> {
  return new Promise((resolve) => {
    const sentinel = "__COMMAND_DONE__";
    let buffer = "";
   
    console.log("executeCommand started");
    const disposable = session.pty.onData((data) => {
      buffer += data;

      if (buffer.includes(sentinel)) {
        disposable.dispose();
        resolve({
          stdout: buffer.slice(0, buffer.indexOf(sentinel)),
          success: true,
        });
      }
    });
    
    console.log("Writing command");
      session.pty.write(command + "\n");
      console.log("Writing sentinel");
    session.pty.write(`echo "${sentinel}"\n`);
  });
}