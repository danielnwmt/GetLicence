import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { hashPassword } from "../auth.js";
import { requireAdmin, requireAuth, type AuthedRequest } from "../middleware.js";
import { onlyDigits, isValidCpfCnpj } from "../lib/cpf-cnpj.js";

const router = Router();
router.use(requireAuth, requireAdmin);

// Lista todos os clientes (oculta admins)
router.get("/", async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT p.*, u.email AS auth_email
     FROM profiles p
     JOIN users u ON u.id = p.user_id
     WHERE NOT EXISTS (
       SELECT 1 FROM user_roles r WHERE r.user_id = p.user_id AND r.role = 'admin'
     )
     ORDER BY p.created_at DESC`,
  );
  res.json({ customers: rows });
});

const createSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(255),
  full_name: z.string().min(1).max(255),
  cpf_cnpj: z.string().min(11).max(20),
  phone: z.string().max(30).optional(),
  address_zip: z.string().max(15).optional(),
  address_street: z.string().max(255).optional(),
  address_number: z.string().max(20).optional(),
  address_complement: z.string().max(255).optional(),
  address_neighborhood: z.string().max(255).optional(),
  address_city: z.string().max(120).optional(),
  address_state: z.string().max(2).optional(),
});

router.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten() });
  const d = parsed.data;
  if (!isValidCpfCnpj(d.cpf_cnpj)) return res.status(400).json({ error: "CPF/CNPJ inválido" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const dup = await client.query("SELECT 1 FROM users WHERE lower(email) = lower($1)", [d.email]);
    if (dup.rowCount) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Email já cadastrado" });
    }
    const hash = await hashPassword(d.password);
    const ins = await client.query<{ id: string }>(
      "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id",
      [d.email, hash],
    );
    const userId = ins.rows[0].id;
    await client.query("INSERT INTO user_roles (user_id, role) VALUES ($1, 'client')", [userId]);
    await client.query(
      `INSERT INTO profiles
         (user_id, full_name, email, cpf_cnpj, phone, address_zip, address_street, address_number,
          address_complement, address_neighborhood, address_city, address_state)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        userId,
        d.full_name.trim(),
        d.email,
        onlyDigits(d.cpf_cnpj),
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
    await client.query("COMMIT");
    res.status(201).json({ ok: true, user_id: userId });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[customers.create]", err);
    res.status(500).json({ error: "Erro ao cadastrar cliente" });
  } finally {
    client.release();
  }
});

router.delete("/:userId", async (req, res) => {
  await pool.query("DELETE FROM users WHERE id = $1", [req.params.userId]);
  res.json({ ok: true });
});

export default router;
