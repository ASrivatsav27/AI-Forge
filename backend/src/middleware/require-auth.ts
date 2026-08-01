import { auth } from "../utils/auth.js";
import { fromNodeHeaders } from "better-auth/node";
import type { Request, Response, NextFunction } from "express";


export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.log("requireAuth hit, cookies:", req.headers.cookie);
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  req.user = session.user;
  req.session = session.session;


  next();
}