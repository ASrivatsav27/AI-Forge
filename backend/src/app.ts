
import express from "express"
import { toNodeHandler } from "better-auth/node";
import { auth } from "./utils/auth.js";
import cors from "cors"
import projectRouter from "./routes/project.route.js";
import { errorHandler } from "./middleware/error-handler.js";
import { serve } from "inngest/express";
import { inngest } from "./config/inngest.js"
import { functions } from "./workflows/index.js";
import type { Request,Response } from "express";

const app = express()

app.use(cors({origin: "http://localhost:3000",credentials: true,}));
// Inngest resends the full accumulated step-output history on every
// request as a step function progresses — generated file contents in
// that history easily exceed Express's 100kb default.
app.use(express.json({ limit: "50mb" }));



app.use("/api/inngest", serve({client: inngest,functions}));

app.all("/api/auth/{*any}", toNodeHandler(auth));

app.use("/project", projectRouter);

app.use(errorHandler);

app.get("/", (req: Request, res: Response) => {
    res.json({
        "message":"Server is running"
    })
})


export default app