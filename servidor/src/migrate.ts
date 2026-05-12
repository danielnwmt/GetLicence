import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const schemaPath = path.resolve(__dirname, "../schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf8");
  console.log("[migrate] aplicando schema.sql...");
  await pool.query(sql);
  console.log("[migrate] ok");
  await pool.end();
}

main().catch((err) => {
  console.error("[migrate] falhou:", err);
  process.exit(1);
});
