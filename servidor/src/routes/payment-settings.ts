import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAdmin, requireAuth } from "../middleware.js";

const router = Router();
router.use(requireAuth, requireAdmin);

router.get("/", async (_req, res) => {
  const { rows } = await pool.query("SELECT * FROM payment_settings LIMIT 1");
  res.json({
    settings: rows[0] ?? null,
    secretStatus: {
      asaas: !!process.env.ASAAS_API_KEY,
      sicredi: !!process.env.SICREDI_CLIENT_ID && !!process.env.SICREDI_CLIENT_SECRET,
      sicoob: !!process.env.SICOOB_CLIENT_ID && !!process.env.SICOOB_ACCESS_TOKEN,
    },
  });
});

const schema = z.object({
  id: z.string().uuid(),
  active_provider: z.enum(["asaas", "sicredi", "sicoob", "manual"]),
  asaas_env: z.enum(["sandbox", "production"]),
  notes: z.string().max(2000).nullable().optional(),
});

router.put("/", async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dados inválidos" });
  const d = parsed.data;
  await pool.query(
    `UPDATE payment_settings SET active_provider=$2, asaas_env=$3, notes=$4 WHERE id=$1`,
    [d.id, d.active_provider, d.asaas_env, d.notes ?? null],
  );
  res.json({ ok: true });
});

export default router;
