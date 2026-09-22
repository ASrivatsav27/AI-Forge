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