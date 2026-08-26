import type { ProjectSession } from "../types/session.js";
import { emitEvent } from "./runtime-events.js";

type ActiveCommand = {
  buffer: string;
  promptIndex: number;
  waitingForInput: boolean;
  finished: boolean;
  disposable: { dispose: () => void } | null;
};

const activeCommands = new Map<string, ActiveCommand>();

function stripAnsi(text: string): string {
  return text.replace(
    /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g,
    ""
  );
}

function isInteractivePrompt(text: string): boolean {
  return (
    /Ok to proceed\? \(y\)/i.test(text) ||
    /Which linter to use\?/i.test(text) ||
    /Press Enter to continue/i.test(text)
  );
}

function isShellPrompt(text: string): boolean {
  const clean = stripAnsi(text).trim();

  return (
    /PS [A-Z]:\\.*>\s*$/i.test(clean) ||
    /[A-Z]:\\.*>\s*$/i.test(clean) ||
    /\/[^\r\n]*\s#\s*$/i.test(clean) ||
    /\/[^\r\n]*\s\$\s*$/i.test(clean)
  );
}

function cleanupActiveCommand(
  projectId: string,
  command: ActiveCommand
): void {
  if (command.disposable) {
    command.disposable.dispose();
    command.disposable = null;
  }

  activeCommands.delete(projectId);
}

/*
 * Starts a command on the session's PTY and returns immediately.
 *
 * This is fire-and-forget. The caller (the workflow) does not
 * block on this call — it learns what happened by awaiting
 * nextEvent(session), which receives whichever event this PTY
 * listener, or createSession's preview detection, pushes next.
 *
 * The workflow never races this against anything. It is not this
 * function's job to decide what "winning" means — it only reports
 * factual PTY state via emitEvent().
 */
export function executeCommand(
  session: ProjectSession,
  command: string
): void {
  const projectId = session.projectId;

  /*
   * Do not allow two unrelated commands to occupy the same
   * PTY at the same time.
   *
   * A long-running command (e.g. a dev server) is allowed to
   * remain active — the agent stops it with sendInput(Ctrl+C)
   * before starting another command.
   */
  const existing = activeCommands.get(projectId);

  if (existing && !existing.finished) {
    throw new Error(
      "Another command is already active for this session."
    );
  }

  const active: ActiveCommand = {
    buffer: "",
    promptIndex: 0,
    waitingForInput: false,
    finished: false,
    disposable: null,
  };

  activeCommands.set(projectId, active);

  console.log("executeCommand started:", command);

  active.disposable = session.pty.onData((data) => {
    active.buffer += data;

    const clean = stripAnsi(active.buffer);

    const latestOutput = stripAnsi(
      active.buffer.slice(active.promptIndex)
    );

    /*
     * ==========================================
     * INTERACTIVE PROMPT
     * ==========================================
     */

    if (
      !active.finished &&
      !active.waitingForInput &&
      isInteractivePrompt(latestOutput)
    ) {
      active.waitingForInput = true;
      active.promptIndex = active.buffer.length;

      console.log("Interactive prompt detected");

      emitEvent(session, {
        kind: "promptDetected",
        text: latestOutput,
      });

      return;
    }

    /*
     * ==========================================
     * SHELL PROMPT
     * ==========================================
     *
     * The running command has returned to the shell —
     * this covers normal completion as well as the shell
     * reappearing after sendInput(Ctrl+C).
     */

    if (
      !active.finished &&
      !active.waitingForInput &&
      isShellPrompt(clean)
    ) {
      active.finished = true;

      console.log("Command finished - shell prompt detected");

      emitEvent(session, {
        kind: "commandCompleted",
        stdout: latestOutput,
        success: true,
      });

      cleanupActiveCommand(projectId, active);

      return;
    }
  });

  console.log("Writing command");

  session.pty.write(command + "\n");
}

export function sendInput(
  session: ProjectSession,
  input: string
): void {
  console.log("sendInput started");
  console.log("Writing input:", JSON.stringify(input));

  /*
   * Ctrl+C is PTY control input. It must be allowed even if
   * there is no bookkeeping ActiveCommand — the PTY itself is
   * the source of truth for the currently running foreground
   * process. No preview timeout, no framework-specific casing:
   * it is ordinary agent-controlled input like anything else.
   */
  const isCtrlC =
    input === "\u0003" ||
    input === "\\u0003" ||
    input === "\x03";

  if (isCtrlC) {
    console.log("Sending Ctrl+C directly to PTY.");
    session.pty.write("\u0003");
    return;
  }

  /*
   * Normal interactive answers still require an active command
   * because "y", "n", and Enter must belong to a known
   * interactive command.
   */
  const active = activeCommands.get(session.projectId);

  if (!active) {
    throw new Error("No active command.");
  }

  active.promptIndex = active.buffer.length;
  active.waitingForInput = false;

  session.pty.write(input + "\n");
}