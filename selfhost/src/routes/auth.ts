import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { pool } from "../db.js";
import {
  COOKIE_NAME,
  hashPassword,
  signSession,
  verifyPassword,
} from "../auth.js";
import { requireAuth, type AuthedRequest } from "../middleware.js";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(255),
});

router.post("/login", loginLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Email ou senha inválidos" });
  const { email, password } = parsed.data;

  const { rows } = await pool.query<{
    id: string;
    password_hash: string;
  }>("SELECT id, password_hash FROM users WHERE lower(email) = lower($1) LIMIT 1", [email]);
  const user = rows[0];
  if (!user) return res.status(401).json({ error: "Credenciais inválidas" });

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "Credenciais inválidas" });

  const { rows: roleRows } = await pool.query<{ role: "admin" | "client" }>(
    "SELECT role FROM user_roles WHERE user_id = $1 ORDER BY role LIMIT 1",
    [user.id],
  );
  const role = roleRows[0]?.role ?? "client";

  const token = signSession(user.id, role);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
  res.json({ ok: true, user: { id: user.id, role } });
});

router.post("/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: "/" });
  res.json({ ok: true });
});

router.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.sub;
  const { rows } = await pool.query(
    `SELECT u.id, u.email, p.full_name, p.cpf_cnpj, p.phone,
            p.address_zip, p.address_street, p.address_number, p.address_complement,
            p.address_neighborhood, p.address_city, p.address_state
     FROM users u
     LEFT JOIN profiles p ON p.user_id = u.id
     WHERE u.id = $1`,
    [userId],
  );
  res.json({ user: rows[0] ?? null, role: req.user!.role });
});

router.post("/change-password", requireAuth, async (req: AuthedRequest, res) => {
  const schema = z.object({
    current_password: z.string().min(1),
    new_password: z.string().min(8).max(255),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dados inválidos" });

  const { rows } = await pool.query<{ password_hash: string }>(
    "SELECT password_hash FROM users WHERE id = $1",
    [req.user!.sub],
  );
  const u = rows[0];
  if (!u) return res.status(404).json({ error: "Usuário não encontrado" });
  const ok = await verifyPassword(parsed.data.current_password, u.password_hash);
  if (!ok) return res.status(401).json({ error: "Senha atual incorreta" });

  const newHash = await hashPassword(parsed.data.new_password);
  await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [newHash, req.user!.sub]);
  res.json({ ok: true });
});

export default router;
