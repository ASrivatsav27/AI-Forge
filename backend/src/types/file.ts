import type{ FileTree } from "../utils/fileTree.js";
import type { AgentStatusEvent } from "./agent-events.js";


export interface ClientToServerEvents {
  "terminal:connect": {
    projectId: string;
  };

  "terminal:write": string;

  "terminal:resize": {
    cols: number;
    rows: number;
  };

  "file:create": {
    relativePath: string;
    content?: string;
  };

  "file:save": {
    relativePath: string;
    content: string;
  };
   
    "file:read": {
        relativePath: string;
    }

  "fs:delete": {
    relativePath: string;
  };

  "folder:create": {
    relativePath: string;
  };

  "fs:rename": {
    oldPath: string;
    newPath: string;
  };

  "fs:move": {
    sourcePath: string;
    destinationPath: string;
  };
}


export interface ServerToClientEvents {
  "terminal:data": (data: string) => void;

  "preview:ready": (port: string) => void;

  "preview:stopped": () => void;

  "preview:error": () => void;

  "file:content": (data: {
    relativePath: string;
    content: string;
     }) => void;

  "filetree:update": (fileTree: FileTree) => void;
  "agent:status":(event:AgentStatusEvent) => void

  // Live file streaming — emitted by services/agent-status.ts
  // (emitFileStreamStart/emitFileDelta/emitFileStreamEnd) but never
  // added here, so tsc rejected the .emit() calls even though the
  // events themselves were already real and already being emitted.
  // Declarations only — no event name or payload changed.
  "agent:file-stream-start": (data: { path: string }) => void;
  "agent:file-delta": (data: { path: string; delta: string }) => void;
  "agent:file-stream-end": (data: { path: string; content: string }) => void;

  // Chat reply for triage "chat" mode — see services/agent-status.ts
  // emitAgentMessage(). No file/path payload; just the answer text.
  "agent:message": (data: { message: string; timestamp: number }) => void;
}

