export type SetupContext = {
  framework: string;
  backend?: string;
  database?: string;
  architecture?: string;
  connectionString?: string;
  /** Setup Agent instructions only. Kept separate from the user's application
   *  prompt so the Coding Agent never reads scaffolding instructions.
   *  The Setup Agent reads this via its user message in setup.agent.ts. */
  setupPrompt?: string;
};

/**
 * A reference image attached to a follow-up prompt (design mockup,
 * screenshot of a bug, UI to match, etc). Only ever populated for
 * follow-ups — the initial build never has one.
 */
export type ImageInput = {
  mediaType: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
  /** Raw base64, no "data:...;base64," prefix. */
  data: string;
};

export type SetupRequestedData = {
  projectId: string;
  /** The user's application requirements. Passed unchanged to both workflows.
   *  The Setup Agent ignores it; the Coding Agent uses it as the sole source
   *  of what to plan and build. */
  prompt: string;
  setupContext: SetupContext;
};

export type SetupResult = {
  success: boolean;
  previewReady: boolean;
  hostPort?: string;
  devCommand?: string;
  reason: string;
};

export type CodingRequestedData = {
  projectId: string;
  prompt: string;
  setupContext: SetupContext;
  /**
   * true only for chat/prompt-box follow-ups sent after the project
   * already has a verified initial build (sendFollowUpPromptController).
   * false for the initial build handed off from setup.workflow.ts, where
   * there's nothing built yet for "chat"/"quick-edit" to apply to — that
   * path always goes straight to full planning.
   */
  isFollowUp: boolean;
  /** Reference image attached to a follow-up prompt, if any. Never set on
   *  the initial build's handoff event. */
  image?: ImageInput;
  setupResult: {
    previewReady: boolean;
    hostPort?: string;
    devCommand?: string;
    reason: string;
  };
};
