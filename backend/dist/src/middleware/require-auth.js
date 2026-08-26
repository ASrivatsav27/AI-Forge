import { auth } from "../utils/auth.js";
import { fromNodeHeaders } from "better-auth/node";
export async function requireAuth(req, res, next) {
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
//# sourceMappingURL=require-auth.js.map