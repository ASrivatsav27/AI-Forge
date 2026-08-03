import type { IPty } from "node-pty";
import type { FSWatcher } from "chokidar";

export type ProjectSession = {
  pty: IPty;
  watcher: FSWatcher;
  clients: Set<string>;

   preview: {
  state: "IDLE" | "STARTING" | "READY" | "STOPPED" | "ERROR";
  hostPort?: string;
};
};