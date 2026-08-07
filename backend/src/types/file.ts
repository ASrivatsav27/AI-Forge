import type{ FileTree } from "../utils/fileTree.js";


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
}