import "dotenv/config";
import { pool } from "./db.js";
import { hashPassword } from "./auth.js";

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "").trim();
  const password = process.env.ADMIN_PASSWORD ?? "";
  const fullName = process.env.ADMIN_NAME ?? "Administrador";

  if (!email || !password) {
    console.error("[seed-admin] ADMIN_EMAIL e ADMIN_PASSWORD precisam estar no .env");
    process.exit(1);
  }

  const existing = await pool.query<{ id: string }>(
    `SELECT u.id FROM users u
     JOIN user_roles r ON r.user_id = u.id
     WHERE r.role = 'admin' LIMIT 1`,
  );
  if (existing.rowCount && existing.rows.length > 0) {
    console.log("[seed-admin] já existe admin, nada a fazer.");
    await pool.end();
    return;
  }

  const hash = await hashPassword(password);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ins = await client.query<{ id: string }>(
      `INSERT INTO users (email, password_hash) VALUES ($1, $2)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
       RETURNING id`,
      [email, hash],
    );
    const userId = ins.rows[0].id;
    await client.query(
      `INSERT INTO user_roles (user_id, role) VALUES ($1, 'admin')
       ON CONFLICT (user_id, role) DO NOTHING`,
      [userId],
    );
    await client.query(
      `INSERT INTO profiles (user_id, full_name, email)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email`,
      [userId, fullName, email],
    );
    await client.query("COMMIT");
    console.log(`[seed-admin] admin criado: ${email}`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[seed-admin] falhou:", err);
  process.exit(1);
});
