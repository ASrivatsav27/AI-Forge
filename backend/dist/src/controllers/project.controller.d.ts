import type { Request, Response } from "express";
export declare function createProjectController(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
export declare function getAllProjectsController(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
type ProjectParams = {
    projectId: string;
};
export declare function deleteProjectController(req: Request<ProjectParams>, res: Response): Promise<Response<any, Record<string, any>>>;
export declare function getProjectDetails(req: Request<ProjectParams>, res: Response): Promise<Response<any, Record<string, any>>>;
export {};
//# sourceMappingURL=project.controller.d.ts.map