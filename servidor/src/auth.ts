import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Request } from "express";

const JWT_SECRET = process.env.JWT_SECRET ?? "";
if (JWT_SECRET.length < 32) {
  console.error("[auth] JWT_SECRET ausente ou curto demais (mínimo 32 chars).");
  process.exit(1);
}

export const COOKIE_NAME = "getlicence_session";
const TOKEN_TTL = "7d";

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signSession(userId: string, role: "admin" | "client"): string {
  return jwt.sign({ sub: userId, role }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

export interface SessionClaims {
  sub: string;
  role: "admin" | "client";
}

export function verifySession(token: string): SessionClaims | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as SessionClaims;
    if (!payload?.sub) return null;
    return payload;
  } catch {
    return null;
  }
}

export function extractToken(req: Request): string | null {
  const cookie = (req as Request & { cookies?: Record<string, string> }).cookies?.[COOKIE_NAME];
  if (cookie) return cookie;
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return null;
}
