export type AgentStage = "setup" | "coding";

export type AgentPhase =
  | "setup:starting"
  | "setup:recovering"
  | "setup:command"
  | "setup:input"
  | "setup:verifying"
  | "setup:done"
  | "coding:planning"
  | "coding:setup-command"
  | "coding:generating"
  | "coding:verifying"
  | "coding:fixing"
  | "coding:installing"
  | "coding:cancelled"
  | "coding:done"
  | "error";

export type AgentStatusEvent = {
  stage: AgentStage;
  phase: AgentPhase;
  message: string;
  file?: string;
  attempt?: number;
  timestamp: number;
};

export type FileStreamStartEvent = {
  path: string;
};

export type FileDeltaEvent = {
  path: string;
  delta: string;
};

export type FileStreamEndEvent = {
  path: string;
  content: string;
};