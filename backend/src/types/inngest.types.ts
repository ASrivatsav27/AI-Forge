
export type SetupContext = {
  framework: string;
  backend?: string;
  database?: string;
  architecture?: string;
  connectionString?: string;
};

export type SetupRequestedData = {
  projectId: string;
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