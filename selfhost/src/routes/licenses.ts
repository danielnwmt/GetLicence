import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAdmin, requireAuth, type AuthedRequest } from "../middleware.js";

const router = Router();

// Lista: admin vê todas, cliente vê apenas as próprias.
router.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const isAdmin = req.user!.role === "admin";
  const { rows } = await pool.query(
    isAdmin
      ? `SELECT l.*, p.name AS product_name, pr.full_name AS customer_name, pr.email AS customer_email
         FROM licenses l
         JOIN products p ON p.id = l.product_id
         LEFT JOIN profiles pr ON pr.user_id = l.user_id
         ORDER BY l.created_at DESC`
      : `SELECT l.*, p.name AS product_name
         FROM licenses l
         JOIN products p ON p.id = l.product_id
         WHERE l.user_id = $1
         ORDER BY l.created_at DESC`,
    isAdmin ? [] : [req.user!.sub],
  );
  res.json({ licenses: rows });
});

const createSchema = z.object({
  user_id: z.string().uuid(),
  product_id: z.string().uuid(),
  plan: z.enum(["monthly", "yearly"]).default("monthly"),
  status: z.enum(["pending", "active", "expired", "cancelled"]).default("pending"),
  starts_at: z.string().optional(),
  expires_at: z.string(),
  auto_renew: z.boolean().optional(),
  notes: z.string().max(2000).optional(),
});

router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dados inválidos" });
  const d = parsed.data;
  const { rows } = await pool.query(
    `INSERT INTO licenses (user_id, product_id, plan, status, starts_at, expires_at, auto_renew, notes)
     VALUES ($1,$2,$3,$4,COALESCE($5::timestamptz, now()),$6::timestamptz,COALESCE($7,true),$8)
     RETURNING *`,
    [
      d.user_id, d.product_id, d.plan, d.status,
      d.starts_at ?? null, d.expires_at, d.auto_renew ?? null, d.notes ?? null,
    ],
  );
  res.status(201).json({ license: rows[0] });
});

router.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  const schema = createSchema.partial();
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dados inválidos" });
  const d = parsed.data;
  const { rows } = await pool.query(
    `UPDATE licenses SET
       plan = COALESCE($2, plan),
       status = COALESCE($3, status),
       expires_at = COALESCE($4::timestamptz, expires_at),
       auto_renew = COALESCE($5, auto_renew),
       notes = COALESCE($6, notes)
     WHERE id = $1 RETURNING *`,
    [
      req.params.id,
      d.plan ?? null, d.status ?? null, d.expires_at ?? null,
      d.auto_renew ?? null, d.notes ?? null,
    ],
  );
  res.json({ license: rows[0] });
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  await pool.query("DELETE FROM licenses WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
});

export default router;
