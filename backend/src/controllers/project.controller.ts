import { createContainer, deleteContainer } from "../services/docker.service.js";
import type { Request,Response } from "express";
import {prisma} from "../config/db.js"
import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from 'uuid';
import { generateFileTree } from "../utils/fileTree.js";
import {inngest} from  "../config/inngest.js" 
import { getIO } from "../socket/io.js";
import { createSession } from "../session/createSession.js";
import { setupRequested, codingRequested } from "../config/inngest.js";

export async function createProjectController(req: Request, res: Response) {
    const {
        name,
        prompt,
        setupPrompt,
        framework,
        backend,
        database,
        architecture,
        connectionString,
    } = req.body
    
    if (!name?.trim()) {
       return res.status(400).json({
            message:"enter a name"
        })
    }
     
    if (!prompt?.trim()) {
        return res.status(400).json({
            message:"enter a prompt"
        })
    }

    if (!setupPrompt?.trim()) {
        return res.status(400).json({
            message:"enter setup instructions"
        })
    }
  
    if (!framework) {
        return res.status(400).json({
            message:"Select a Development environment"
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
            workspacePath: workspacePath,
            containerId: container.id,
            userId: userId
        }
    })
  
    await createSession(project, getIO());
  
    await inngest.send(
        setupRequested.create({
            projectId,
            // Only the user's application requirements go here.
            // The Setup Agent ignores this field entirely.
            // The Coding Agent uses it as the sole source of what to build.
            prompt,
            setupContext: {
                framework,
                backend,
                database,
                architecture,
                connectionString,
                // Setup Agent reads this via its user message in setup.agent.ts.
                // The Coding Agent never sees this field — it is not part of
                // the `prompt` that flows into planProject / generateFileContent.
                setupPrompt,
            },
        })
    );
  
    return res.status(201).json({
        message:"Project created successfully", project
    });
}

export async function sendFollowUpPromptController(req: Request<ProjectParams>, res: Response) {
    const { projectId } = req.params;
    const { prompt, image } = req.body;
    const userId = req.user.id;

    if (!prompt?.trim()) {
        return res.status(400).json({
            message: "enter a prompt",
        });
    }

    if (image !== undefined) {
        const validMediaTypes = ["image/png", "image/jpeg", "image/gif", "image/webp"];

        if (
            typeof image !== "object" ||
            image === null ||
            typeof image.data !== "string" ||
            !image.data.trim() ||
            !validMediaTypes.includes(image.mediaType)
        ) {
            return res.status(400).json({
                message: "Invalid image attachment.",
            });
        }
    }

    const project = await prisma.project.findFirst({
        where: {
            id: projectId,
            userId,
        },
    });

    if (!project) {
        return res.status(404).json({
            message: "Project not found",
        });
    }

    if (project.setupStatus !== "READY") {
        return res.status(409).json({
            message: "Project setup is not ready yet.",
        });
    }

    await inngest.send(
        codingRequested.create({
            projectId,
            prompt,
            isFollowUp: true,
            ...(image ? { image } : {}),
            setupContext: {
                framework: "",
            },
            setupResult: {
                previewReady: true,
                reason: "Follow-up prompt — reusing already-verified setup.",
            },
        })
    );

    return res.status(202).json({
        message: "Follow-up prompt sent",
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
        message:"Projects fetched successfully", projects
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
    const project = await prisma.project.findFirst({
        where: {
            id: projectId,
            userId,
        },
    });
    
    if (!project) {
        return res.status(404).json({
            message: "Project not found",
        });
    }
    
    await prisma.project.delete({
        where: {
            id: projectId,
        },
    });
  
    await fs.rm(workspacePath, { recursive: true, force: true });

    return res.status(200).json({
        message:"Project Deleted successfully", project
    })
}

export async function getProjectDetails(req: Request<ProjectParams>, res: Response) {
    const { projectId } = req.params
    const userId = req.user.id;

    const project = await prisma.project.findFirst({
        where: {
            id: projectId,
            userId
        },
        select: {
            id: true,
            name: true,
            createdAt: true,
            updatedAt: true,
            workspacePath: true,
            containerId: true
        },
    })
  
    if (!project) {
        return res.status(404).json({
            message:"No project found"
        })
    }

    const fileTree = await generateFileTree(project.workspacePath);
  
    return res.status(200).json({
        message: "Fetched project details",
        project,
        fileTree,
    })
}
