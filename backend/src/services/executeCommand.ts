import type { ProjectSession } from "../types/session.js";

export interface CommandResult {
  stdout: string;
  success: boolean;
}

type ActiveCommand = {
  buffer: string;
  promptIndex: number;
  waitingForInput: boolean;
  finished: boolean;
  resolve: ((result: CommandResult) => void) | null;
  disposable: { dispose: () => void } | null;
};

const activeCommands = new Map<string, ActiveCommand>();

function stripAnsi(text: string): string {
  return text.replace(
    /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g,
    ""
  );
}
function isShellPrompt(text: string): boolean {
  return (
    /\r?\nPS [A-Z]:\\.*>\s*$/i.test(text) ||
    /\r?\n[A-Z]:\\.*>\s*$/i.test(text) ||
    /\r?\n\/.*\s#\s*$/i.test(text) ||
    /\r?\n\/.*\s\$\s*$/i.test(text)
  );
}
function resolveWaiting(
  command: ActiveCommand,
  stdout: string
): void {
  if (!command.resolve) {
    return;
  }

  const resolve = command.resolve;
  command.resolve = null;

  resolve({
    stdout,
    success: true,
  });
}

export async function executeCommand(
  session: ProjectSession,
  command: string
): Promise<CommandResult> {
  const projectId = session.projectId;

  return new Promise((resolve) => {
    const active: ActiveCommand = {
      buffer: "",
      promptIndex: 0,
      waitingForInput: false,
      finished: false,
      resolve,
      disposable: null,
    };

    activeCommands.set(projectId, active);

    console.log("executeCommand started");

    active.disposable = session.pty.onData((data) => {
      active.buffer += data;

      const clean = stripAnsi(active.buffer);

      // Detect a new interactive prompt.
      if (
        !active.finished &&
        !active.waitingForInput &&
        isInteractivePrompt(
          stripAnsi(
            active.buffer.slice(active.promptIndex)
          )
        )
      ) {
        active.waitingForInput = true;
        active.promptIndex = active.buffer.length;

        console.log("Interactive prompt detected");

        resolveWaiting(active, clean);

        return;
      }

      // The command is currently running after input.
      if (!active.waitingForInput) {
        return;
      }

      const latestOutput = stripAnsi(
        active.buffer.slice(active.promptIndex)
      );

      // Detect another interactive prompt.
      if (isInteractivePrompt(latestOutput)) {
        active.waitingForInput = true;
        active.promptIndex = active.buffer.length;

        console.log("Next interactive prompt detected");

        resolveWaiting(
          active,
          latestOutput
        );

        return;
      }

      // Detect command returning to the shell.
      if (isShellPrompt(clean)) {
        active.finished = true;
        active.waitingForInput = false;

        const result: CommandResult = {
          stdout: latestOutput,
          success: true,
        };

        if (active.disposable) {
          active.disposable.dispose();
        }

        activeCommands.delete(projectId);

        resolveWaiting(
          active,
          result.stdout
        );
      }
    });

    console.log("Writing command");

    session.pty.write(command + "\n");
  });
}

export function sendInput(
  session: ProjectSession,
  input: string
): void {
  console.log("sendInput started");

  console.log(
    "Writing input:",
    JSON.stringify(input)
  );

  const active = activeCommands.get(
    session.projectId
  );

  if (!active) {
    throw new Error("No active command.");
  }

  /*
   * The current prompt has been answered.
   *
   * Move the index forward so the old prompt
   * cannot be detected again.
   */
  active.promptIndex = active.buffer.length;
  active.waitingForInput = false;

  session.pty.write(input + "\n");
}

export async function waitForCommandResult(
  session: ProjectSession
): Promise<CommandResult> {
  const active = activeCommands.get(
    session.projectId
  );

  if (!active) {
    throw new Error("No active command.");
  }

  return new Promise((resolve) => {
    active.resolve = resolve;
  });
}