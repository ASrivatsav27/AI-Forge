

export type createProjectPayload = {
    name: string,
}


export type DeleteProjectPayload = {
    id: string,
    
}
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
     id: string
}

export type FileTree = {
    [key: string]: FileTree | null;
};