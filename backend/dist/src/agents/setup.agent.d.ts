export type SetupRequest = {
    projectId: string;
    prompt: string;
    observation?: string | undefined;
};
export type AgentAction = {
    tool: "executeCommand";
    command: string;
} | {
    tool: "sendInput";
    input: string;
} | {
    tool: "finish";
    reason: string;
};
export declare function setupAgent(data: SetupRequest): Promise<AgentAction>;
//# sourceMappingURL=setup.agent.d.ts.map