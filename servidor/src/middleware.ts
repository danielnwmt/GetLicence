import type { Request, Response, NextFunction } from "express";
import { extractToken, verifySession, type SessionClaims } from "./auth.js";

export interface AuthedRequest extends Request {
  user?: SessionClaims;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: "Não autenticado" });
  const claims = verifySession(token);
  if (!claims) return res.status(401).json({ error: "Sessão inválida ou expirada" });
  req.user = claims;
  next();
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: "Não autenticado" });
  if (req.user.role !== "admin") return res.status(403).json({ error: "Acesso negado" });
  next();
}
