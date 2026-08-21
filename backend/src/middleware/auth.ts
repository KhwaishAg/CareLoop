import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../services/auth.service";
import type { Role } from "@prisma/client";

export interface AuthedRequest extends Request {
  user?: { id: string; role: Role };
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or malformed Authorization header" });
  }

  const token = header.slice("Bearer ".length);
  try {
    const payload = verifyToken(token);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

/** Usage: requireRole("ADMIN") or requireRole("ADMIN", "DOCTOR") */
export function requireRole(...roles: Role[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "You don't have access to this resource" });
    }
    next();
  };
}
