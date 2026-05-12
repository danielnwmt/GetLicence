import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAuth, type AuthedRequest } from "../middleware.js";
import { onlyDigits, isValidCpfCnpj } from "../lib/cpf-cnpj.js";

const router = Router();

router.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM profiles WHERE user_id = $1`,
    [req.user!.sub],
  );
  res.json({ profile: rows[0] ?? null });
});

const updateSchema = z.object({
  full_name: z.string().max(255).optional(),
  cpf_cnpj: z.string().max(20).optional(),
  phone: z.string().max(30).optional(),
  address_zip: z.string().max(15).optional(),
  address_street: z.string().max(255).optional(),
  address_number: z.string().max(20).optional(),
  address_complement: z.string().max(255).optional(),
  address_neighborhood: z.string().max(255).optional(),
  address_city: z.string().max(120).optional(),
  address_state: z.string().max(2).optional(),
});

router.put("/", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dados inválidos" });
  const d = parsed.data;

  if (d.cpf_cnpj && !isValidCpfCnpj(d.cpf_cnpj)) {
    return res.status(400).json({ error: "CPF/CNPJ inválido" });
  }

  await pool.query(
    `UPDATE profiles SET
       full_name = COALESCE($2, full_name),
       cpf_cnpj = COALESCE($3, cpf_cnpj),
       phone = COALESCE($4, phone),
       address_zip = COALESCE($5, address_zip),
       address_street = COALESCE($6, address_street),
       address_number = COALESCE($7, address_number),
       address_complement = COALESCE($8, address_complement),
       address_neighborhood = COALESCE($9, address_neighborhood),
       address_city = COALESCE($10, address_city),
       address_state = COALESCE($11, address_state)
     WHERE user_id = $1`,
    [
      req.user!.sub,
      d.full_name ?? null,
      d.cpf_cnpj ? onlyDigits(d.cpf_cnpj) : null,
      d.phone ? onlyDigits(d.phone) : null,
      d.address_zip ? onlyDigits(d.address_zip) : null,
      d.address_street ?? null,
      d.address_number ?? null,
      d.address_complement ?? null,
      d.address_neighborhood ?? null,
      d.address_city ?? null,
      d.address_state ?? null,
    ],
  );
  res.json({ ok: true });
});

export default router;
