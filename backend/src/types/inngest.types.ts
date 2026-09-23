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
  setupResult: {
    previewReady: boolean;
    hostPort?: string;
    devCommand?: string;
    reason: string;
  };
};
