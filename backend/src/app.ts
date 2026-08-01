
import express from "express"
import { toNodeHandler } from "better-auth/node";
import { auth } from "./utils/auth.js";
import cors from "cors"
import projectRouter from "./routes/project.route.js";


const app = express()

app.use(express.json()) 
app.use(cors({ origin: "http://localhost:3000", credentials: true }));
app.all("/api/auth/{*any}", toNodeHandler(auth));
app.use("/project", projectRouter)
app.get("/hello", (req, res) => {
  res.send("hello");
});

export default app