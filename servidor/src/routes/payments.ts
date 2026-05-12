import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAdmin, requireAuth, type AuthedRequest } from "../middleware.js";

const router = Router();

router.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const isAdmin = req.user!.role === "admin";
  const { rows } = await pool.query(
    isAdmin
      ? `SELECT p.*, pr.full_name AS customer_name FROM payments p
         LEFT JOIN profiles pr ON pr.user_id = p.user_id
         ORDER BY p.created_at DESC`
      : `SELECT * FROM payments WHERE user_id = $1 ORDER BY created_at DESC`,
    isAdmin ? [] : [req.user!.sub],
  );
  res.json({ payments: rows });
});

const createSchema = z.object({
  user_id: z.string().uuid(),
  license_id: z.string().uuid(),
  amount: z.number().positive(),
  method: z.string().max(40).optional(),
  status: z.enum(["pending", "paid", "failed", "refunded"]).default("pending"),
  due_date: z.string().optional(),
  reference: z.string().max(255).optional(),
  notes: z.string().max(2000).optional(),
});

router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dados inválidos" });
  const d = parsed.data;
  const { rows } = await pool.query(
    `INSERT INTO payments (user_id, license_id, amount, method, status, due_date, reference, notes)
     VALUES ($1,$2,$3,$4,$5,$6::date,$7,$8) RETURNING *`,
    [d.user_id, d.license_id, d.amount, d.method ?? null, d.status, d.due_date ?? null, d.reference ?? null, d.notes ?? null],
  );
  res.status(201).json({ payment: rows[0] });
});

router.put("/:id/mark-paid", requireAuth, requireAdmin, async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE payments SET status = 'paid', paid_at = now() WHERE id = $1 RETURNING *`,
    [req.params.id],
  );
  res.json({ payment: rows[0] });
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  await pool.query("DELETE FROM payments WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
});

export default router;
