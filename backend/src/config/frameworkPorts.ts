/**
 * Single source of truth for which container port each framework's dev
 * server binds to. This MUST stay in sync with the exact commands in
 * setup.agent.ts's SYSTEM_PROMPT — neither framework's command passes a
 * --port flag, so each binds to its own tool's default port.
 *
 * If setup.agent.ts is ever changed to pass an explicit --port flag for
 * either framework, this mapping must change in the same commit, or
 * previewOrigin will silently point at the wrong container port.
 */
export const FRAMEWORK_CONTAINER_PORT: Record<string, string> = {
  "Next.js": "3000", // next dev default — setup.agent.ts never passes --port
  "React": "5173",   // vite dev default — setup.agent.ts never passes --port
};

export function getFrameworkContainerPort(framework: string): string | undefined {
  return FRAMEWORK_CONTAINER_PORT[framework];
}
