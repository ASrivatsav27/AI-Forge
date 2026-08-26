const activeCommands = new Map();
function stripAnsi(text) {
    return text.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, "");
}
function isInteractivePrompt(text) {
    return (/Ok to proceed\? \(y\)/i.test(text) ||
        /Which linter to use\?/i.test(text) ||
        /Press Enter to continue/i.test(text));
}
function isShellPrompt(text) {
    const clean = stripAnsi(text).trim();
    return (/PS [A-Z]:\\.*>\s*$/i.test(clean) ||
        /[A-Z]:\\.*>\s*$/i.test(clean) ||
        /\/[^\r\n]*\s#\s*$/i.test(clean) ||
        /\/[^\r\n]*\s\$\s*$/i.test(clean));
}
function resolveWaiting(command, stdout) {
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
function cleanupActiveCommand(projectId, command) {
    if (command.disposable) {
        command.disposable.dispose();
        command.disposable = null;
    }
    activeCommands.delete(projectId);
}
export async function executeCommand(session, command) {
    const projectId = session.projectId;
    /*
     * Do not allow two unrelated commands to occupy the same
     * PTY at the same time.
     *
     * A long-running command is allowed to remain active,
     * but the agent must first stop it with sendInput()
     * before starting another command.
     */
    const existing = activeCommands.get(projectId);
    if (existing && !existing.finished) {
        throw new Error("Another command is already active for this session.");
    }
    return new Promise((resolve) => {
        const active = {
            buffer: "",
            promptIndex: 0,
            waitingForInput: false,
            finished: false,
            detached: false,
            resolve,
            disposable: null,
        };
        activeCommands.set(projectId, active);
        console.log("executeCommand started:", command);
        active.disposable = session.pty.onData((data) => {
            active.buffer += data;
            const clean = stripAnsi(active.buffer);
            const latestOutput = stripAnsi(active.buffer.slice(active.promptIndex));
            /*
             * ==========================================
             * INTERACTIVE PROMPT
             * ==========================================
             */
            if (!active.finished &&
                !active.waitingForInput &&
                isInteractivePrompt(latestOutput)) {
                active.waitingForInput = true;
                active.promptIndex =
                    active.buffer.length;
                console.log("Interactive prompt detected");
                resolveWaiting(active, latestOutput);
                return;
            }
            /*
             * ==========================================
             * SHELL PROMPT
             * ==========================================
             *
             * This means the running command has
             * actually returned to the shell.
             *
             * This is especially important after:
             *
             * sendInput(Ctrl+C)
             *
             * when Claude stops a development server.
             */
            if (!active.finished &&
                !active.waitingForInput &&
                isShellPrompt(clean)) {
                active.finished = true;
                active.detached = false;
                console.log("Command finished - shell prompt detected");
                const result = {
                    stdout: latestOutput,
                    success: true,
                };
                cleanupActiveCommand(projectId, active);
                resolveWaiting(active, result.stdout);
                return;
            }
        });
        console.log("Writing command");
        session.pty.write(command + "\n");
    });
}
export function markCommandDetached(session) {
    const active = activeCommands.get(session.projectId);
    if (!active) {
        return;
    }
    /*
     * The workflow has stopped waiting for the
     * original command because runtime preview
     * activity was detected.
     *
     * IMPORTANT:
     *
     * We do NOT kill the PTY.
     * We do NOT dispose the listener.
     * The development server is still running.
     *
     * Claude may later send Ctrl+C.
     */
    active.detached = true;
    console.log("Active command detached from workflow wait.");
}
export function sendInput(session, input) {
    console.log("sendInput started");
    console.log("Writing input:", JSON.stringify(input));
    /*
     * Ctrl+C is PTY control input.
     *
     * It must be allowed even if executeCommand's
     * bookkeeping no longer has an ActiveCommand.
     *
     * The PTY itself is the source of truth for the
     * currently running foreground process.
     */
    const isCtrlC = input === "\u0003" ||
        input === "\\u0003" ||
        input === "\x03";
    if (isCtrlC) {
        console.log("Sending Ctrl+C directly to PTY.");
        session.pty.write("\u0003");
        return;
    }
    /*
     * Normal interactive answers still require
     * an active command because things such as
     * "y", "n", and Enter must belong to a known
     * interactive command.
     */
    const active = activeCommands.get(session.projectId);
    if (!active) {
        throw new Error("No active command.");
    }
    active.promptIndex =
        active.buffer.length;
    active.waitingForInput = false;
    session.pty.write(input + "\n");
}
export async function waitForCommandResult(session) {
    const active = activeCommands.get(session.projectId);
    if (!active) {
        throw new Error("No active command.");
    }
    /*
     * If the command already returned to the shell,
     * don't create a new unresolved waiter.
     */
    if (active.finished) {
        throw new Error("Command has already finished.");
    }
    return new Promise((resolve) => {
        active.resolve = resolve;
    });
}
//# sourceMappingURL=executeCommand.js.map