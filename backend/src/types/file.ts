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