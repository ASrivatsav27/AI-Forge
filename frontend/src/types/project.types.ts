export type createProjectPayload = {
    name: string;

    /** The user's application requirements only. Sent as `prompt` to both
     *  workflows. The Setup Agent ignores it; the Coding Agent uses it as
     *  the sole source of what to build. */
    prompt: string;

    /** Setup Agent instructions only. Passed as setupContext.setupPrompt so
     *  it is visible exclusively in the Setup Agent's user message and never
     *  reaches the Coding Agent's planning prompt. */
    setupPrompt: string;

    framework: string;
    backend?: string;
    database?: string;
    architecture?: string;
    connectionString?: string;
};


export type SendFollowUpPromptPayload = {
    projectId: string;
    prompt: string;
    force?: boolean;
};

export type FollowUpPromptResult = {
    requiresConfirmation: boolean;
    message?: string;
};

export type DeleteProjectPayload = {
    id: string;
};


// Dashboard

export interface Project {
    id: string;
    name: string;
    createdAt: string;
}


// IDE page

export interface ProjectDetails extends Project {
    workspacePath: string;
    containerId: string;
    fileTree: any[];
    ports: Record<string, string>;
}


export type ProjectDetailsPayload = {
    id: string;
};


export type FileTree = {
    [key: string]: FileTree | null;
};
