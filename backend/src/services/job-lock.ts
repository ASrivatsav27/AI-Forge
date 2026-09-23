import { randomUUID } from "crypto";

type Lock = {
  token: string;
  cancelRequested: boolean;
};

const running = new Map<string, Lock>();

export function isProjectBusy(projectId: string): boolean {
  return running.has(projectId);
}

/** Normal acquire — fails if something is already running. */
export function lockProject(projectId: string): string | null {
  if (running.has(projectId)) return null;
  const token = randomUUID();
  running.set(projectId, { token, cancelRequested: false });
  return token;
}

/** Marks any current run as cancel-requested and immediately takes the slot. */
export function forceLockProject(projectId: string): string {
  const existing = running.get(projectId);
  if (existing) existing.cancelRequested = true;

  const token = randomUUID();
  running.set(projectId, { token, cancelRequested: false });
  return token;
}

/** True if this token has been superseded or told to stop. */
export function isCancelRequested(projectId: string, token: string): boolean {
  const lock = running.get(projectId);
  return !lock || lock.token !== token || lock.cancelRequested;
}

/** Only clears the lock if it still belongs to this token — never removes a newer run's lock. */
export function unlockProject(projectId: string, token: string): void {
  const lock = running.get(projectId);
  if (lock && lock.token === token) running.delete(projectId);
}
