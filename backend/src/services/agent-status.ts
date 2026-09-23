import { getIO } from "../socket/io.js";
import type { AgentStatusEvent,AgentPhase,AgentStage } from "../types/agent-events.js";
export function emitAgentStatus(
  projectId: string,
  stage: AgentStage,
  phase: AgentPhase,
  message: string,
  extra?: Partial<Pick<AgentStatusEvent, "file" | "attempt">>,
) {
  const event: AgentStatusEvent = {
    stage,
    phase,
    message,
    timestamp: Date.now(),
    ...extra,
  };

  getIO().to(projectId).emit("agent:status", event);
}

// ─────────────────────────────────────────────────────────────
// LIVE FILE STREAMING — separate channel from agent:status since
// the payload shape (path/delta/content) differs from the generic
// status event.
// ─────────────────────────────────────────────────────────────

export function emitFileStreamStart(projectId: string, path: string) {
  getIO().to(projectId).emit("agent:file-stream-start", { path });
}

export function emitFileDelta(projectId: string, path: string, delta: string) {
  getIO().to(projectId).emit("agent:file-delta", { path, delta });
}

export function emitFileStreamEnd(projectId: string, path: string, content: string) {
  getIO().to(projectId).emit("agent:file-stream-end", { path, content });
}