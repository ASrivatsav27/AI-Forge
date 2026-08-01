import { Router } from "express";
import { requireAuth } from "../middleware/require-auth.js";
import { createProjectController, deleteProjectController, getAllProjectsController } from "../controllers/project.controller.js";

const projectRouter = Router()

projectRouter.post("/createProject", requireAuth, createProjectController)
projectRouter.get("/", requireAuth, getAllProjectsController)
projectRouter.delete("/:projectId",requireAuth,deleteProjectController)

export default projectRouter