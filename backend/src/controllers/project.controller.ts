import { createContainer } from "../services/docker.service.js";
import type { Request,Response } from "express";
import {prisma} from "../config/db.js"
import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from 'uuid';



export async function createProjectController(req: Request, res: Response) {
    const { name } = req.body
    
    if (!name) {
        res.status(401).json({
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
    
    return res.status(201).json({
        message:"Project created successfully",project
    });


}
