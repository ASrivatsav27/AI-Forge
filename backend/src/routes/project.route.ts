import { Router } from "express";
import { requireAuth } from "../middleware/require-auth.js";
import { createProjectController } from "../controllers/project.controller.js";

const projectRouter = Router()

projectRouter.post("/createProject",requireAuth,createProjectController)

export default projectRouter