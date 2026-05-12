import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAdmin, requireAuth, type AuthedRequest } from "../middleware.js";

const router = Router();

// Clientes veem produtos ativos; admin vê tudo.
router.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const isAdmin = req.user!.role === "admin";
  const { rows } = await pool.query(
    isAdmin
      ? "SELECT * FROM products ORDER BY name"
      : "SELECT * FROM products WHERE active = true ORDER BY name",
  );
  res.json({ products: rows });
});

const productSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  price_monthly: z.number().nonnegative(),
  price_yearly: z.number().nonnegative(),
  active: z.boolean().optional(),
  cost_vps: z.number().nonnegative().optional(),
  cost_storage: z.number().nonnegative().optional(),
  cost_other: z.number().nonnegative().optional(),
  profit_margin: z.number().optional(),
  vps_specs: z.string().max(500).optional(),
  storage_amount: z.number().nonnegative().optional(),
  storage_unit: z.string().max(8).optional(),
  vps_storage_amount: z.number().nonnegative().optional(),
  vps_storage_unit: z.string().max(8).optional(),
});

router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dados inválidos" });
  const d = parsed.data;
  const { rows } = await pool.query(
    `INSERT INTO products (name, description, price_monthly, price_yearly, active,
       cost_vps, cost_storage, cost_other, profit_margin, vps_specs,
       storage_amount, storage_unit, vps_storage_amount, vps_storage_unit)
     VALUES ($1,$2,$3,$4,COALESCE($5,true),
       COALESCE($6,0),COALESCE($7,0),COALESCE($8,0),COALESCE($9,0),COALESCE($10,''),
       COALESCE($11,0),COALESCE($12,'GB'),COALESCE($13,0),COALESCE($14,'GB'))
     RETURNING *`,
    [
      d.name, d.description ?? null, d.price_monthly, d.price_yearly, d.active ?? true,
      d.cost_vps ?? 0, d.cost_storage ?? 0, d.cost_other ?? 0, d.profit_margin ?? 0, d.vps_specs ?? "",
      d.storage_amount ?? 0, d.storage_unit ?? "GB", d.vps_storage_amount ?? 0, d.vps_storage_unit ?? "GB",
    ],
  );
  res.status(201).json({ product: rows[0] });
});

router.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  const parsed = productSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dados inválidos" });
  const d = parsed.data;
  const { rows } = await pool.query(
    `UPDATE products SET
       name = COALESCE($2,name),
       description = COALESCE($3,description),
       price_monthly = COALESCE($4,price_monthly),
       price_yearly = COALESCE($5,price_yearly),
       active = COALESCE($6,active),
       cost_vps = COALESCE($7,cost_vps),
       cost_storage = COALESCE($8,cost_storage),
       cost_other = COALESCE($9,cost_other),
       profit_margin = COALESCE($10,profit_margin),
       vps_specs = COALESCE($11,vps_specs),
       storage_amount = COALESCE($12,storage_amount),
       storage_unit = COALESCE($13,storage_unit),
       vps_storage_amount = COALESCE($14,vps_storage_amount),
       vps_storage_unit = COALESCE($15,vps_storage_unit)
     WHERE id = $1 RETURNING *`,
    [
      req.params.id,
      d.name ?? null, d.description ?? null, d.price_monthly ?? null, d.price_yearly ?? null, d.active ?? null,
      d.cost_vps ?? null, d.cost_storage ?? null, d.cost_other ?? null, d.profit_margin ?? null, d.vps_specs ?? null,
      d.storage_amount ?? null, d.storage_unit ?? null, d.vps_storage_amount ?? null, d.vps_storage_unit ?? null,
    ],
  );
  res.json({ product: rows[0] });
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  await pool.query("DELETE FROM products WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
});

export default router;
