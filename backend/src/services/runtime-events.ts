import type { ProjectSession } from "../types/session.js";

/*
 * ============================================================
 * RUNTIME EVENTS
 * ============================================================
 *
 * This is the single channel through which the runtime tells
 * the workflow that something factual happened. It is
 * intentionally the ONLY such channel: whether an event
 * originates from a command's own PTY listener (a prompt
 * appeared, the shell returned) or from the preview
 * infrastructure (a server was detected, verified, or
 * stopped), it is emitted here the same way.
 *
 * The workflow never chooses between "the command" and "the
 * preview" — it just asks for the next event. Which source
 * produced it is not something the workflow needs to know or
 * decide.
 */
export type RuntimeEvent =
  | { kind: "promptDetected"; text: string }
  | { kind: "commandCompleted"; stdout: string; success: boolean }
  | { kind: "previewReady"; hostPort: string }
  | { kind: "previewError"; reason: string }
  | { kind: "previewStopped" };

type SessionEventState = {
  queue: RuntimeEvent[];
  waiters: Array<(event: RuntimeEvent) => void>;
};

const sessionEventState = new Map<string, SessionEventState>();

function getState(projectId: string): SessionEventState {
  let state = sessionEventState.get(projectId);
  if (!state) {
    state = { queue: [], waiters: [] };
    sessionEventState.set(projectId, state);
  }
  return state;
}

/*
 * Called by runtime components (executeCommand, createSession)
 * whenever something factual happens. Never called by the
 * workflow itself.
 */
export function emitEvent(
  session: ProjectSession,
  event: RuntimeEvent
): void {
  const state = getState(session.projectId);
  const waiter = state.waiters.shift();
  if (waiter) {
    waiter(event);
    return;
  }
  state.queue.push(event);
}

/*
 * Called by the workflow. Resolves with whatever event happens
 * next, from whichever runtime component produces it first.
 * There is no decision logic here about which kind of event
 * "wins" — it is a plain FIFO queue.
 */
export function nextEvent(
  session: ProjectSession
): Promise<RuntimeEvent> {
  const state = getState(session.projectId);
  const queued = state.queue.shift();
  if (queued) {
    return Promise.resolve(queued);
  }
  return new Promise((resolve) => {
    state.waiters.push(resolve);
  });
}