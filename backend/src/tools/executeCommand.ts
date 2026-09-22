import type { ProjectSession } from "../types/session.js";
import { emitEvent } from "../services/runtime-events.js";

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
    /Press Enter to continue/i.test(text) ||
    /Install with npm and start now\?/i.test(text)
  );
}

function isShellPrompt(text: string): boolean {
  const clean = stripAnsi(text).trim();

  return (
    /PS [A-Z]:\\.*>\s*$/i.test(clean) ||
    /[A-Z]:\\.*>\s*$/i.test(clean) ||
    /[#$]\s*$/.test(clean)
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

export function executeCommand(
  session: ProjectSession,
  command: string
): void {
  const projectId = session.projectId;

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
     * Shell prompt reappearing covers normal completion. Ctrl+C
     * completion is handled directly in sendInput() below, NOT
     * here — see the comment there for why.
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

  const isCtrlC =
    input === "\u0003" ||
    input === "\\u0003" ||
    input === "\x03";

  if (isCtrlC) {
    console.log("Sending Ctrl+C directly to PTY.");
    session.pty.write("\u0003");

    /*
     * We retire the active command HERE instead of waiting for
     * isShellPrompt() to notice the prompt reappear in onData,
     * because that regex is unreliable across container prompt
     * formats and previously left the ActiveCommand stuck as
     * "not finished" forever, which made the NEXT executeCommand()
     * call throw "Another command is already active for this
     * session."
     *
     * IMPORTANT: cleanupActiveCommand() disposes the onData
     * listener — the SAME listener that is normally what emits
     * "commandCompleted". Once cleanupActiveCommand runs, that
     * listener is gone and will never fire again. So we must emit
     * "commandCompleted" ourselves, right here, BEFORE cleaning up
     * — otherwise any caller doing `await nextEvent(session)` right
     * after sendInput(Ctrl+C) (e.g. codingWorkflow's
     * stop-failed-server step) hangs forever waiting for an event
     * nothing will ever send. This was a regression introduced by
     * the earlier fix for the "Another command is already active"
     * bug — fixing that one broke this one, because both bugs
     * shared the same root cause (Ctrl+C not being handled as a
     * first-class command-completion path) and only one side of it
     * was patched.
     */
    const active = activeCommands.get(session.projectId);
    if (active && !active.finished) {
      active.finished = true;

      const finalOutput = stripAnsi(
        active.buffer.slice(active.promptIndex)
      );

      emitEvent(session, {
        kind: "commandCompleted",
        stdout: finalOutput,
        success: true,
      });

      cleanupActiveCommand(session.projectId, active);
    }

    return;
  }

  const active = activeCommands.get(session.projectId);

  if (!active) {
    throw new Error("No active command.");
  }

  active.promptIndex = active.buffer.length;
  active.waitingForInput = false;

  session.pty.write(input + "\n");
}