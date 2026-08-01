import { createContainer, deleteContainer } from "../services/docker.service.js";
import type { Request,Response } from "express";
import {prisma} from "../config/db.js"
import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from 'uuid';



export async function createProjectController(req: Request, res: Response) {
    const { name } = req.body
    
    if (!name) {
       return res.status(400).json({
            message:"enter a name"
        })
    }
     
    const userId = req.user.id
    const projectId = uuidv4()
    const workspacePath = path.resolve(process.env.WORKSPACE_PATH!, projectId);
    
    await fs.mkdir(workspacePath, {
      recursive: true,
    });
    const container = await createContainer(
      projectId,
      workspacePath
    );

    const project = await prisma.project.create({
        data: {
        id: projectId,
        name,
        workspacePath:workspacePath,
        containerId: container.id,
        userId:userId
        }

    })
    
    return res.status(200).json({
        message:"Project created successfully",project
    });


}

export async function getAllProjectsController(req: Request,res: Response) {
  const userId = req.user.id;

  const projects = await prisma.project.findMany({
    where: {
      userId,
    },
  });

    return res.status(200).json({
        message:"Projects fetched successfully",projects
  });
}

type ProjectParams = {
  projectId: string;
};


export async function deleteProjectController(req: Request<ProjectParams>, res: Response) {
    const { projectId } = req.params;
     try {
      await deleteContainer(projectId);
     } catch (err) {
     console.warn("Failed to delete container:", err);
    }
    const workspacePath = path.resolve(process.env.WORKSPACE_PATH!, projectId);
    
    const userId = req.user.id

    await fs.rm(workspacePath, { recursive: true, force: true });

    const project =  await prisma.project.delete({
       where: {
             id: projectId!,
            userId:userId
     },
   });
    
    if (!project) {
    return res.status(404).json({ message: "Project not found",});
   }
    
    
    return res.status(200).json({
        message:"Project Deleted successfully",project
    })
}