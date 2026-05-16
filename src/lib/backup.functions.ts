import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runBackup } from "./backup.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const RESTORE_TABLES = [
  "profiles",
  "user_roles",
  "products",
  "licenses",
  "payments",
  "payables",
  "payment_settings",
] as const;

async function ensureAdmin(supabase: any, userId: string) {
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (!roles?.some((r: any) => r.role === "admin")) {
    throw new Error("Apenas admin pode executar essa ação");
  }
}

export const runBackupNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    return runBackup();
  });

export const restoreBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { dump: string }) => {
    if (!input?.dump || typeof input.dump !== "string") throw new Error("Backup vazio");
    if (input.dump.length > 50_000_000) throw new Error("Arquivo muito grande");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);

    let parsed: Record<string, unknown[]>;
    try {
      parsed = JSON.parse(data.dump);
    } catch {
      throw new Error("JSON inválido");
    }

    const summary: Record<string, number> = {};
    for (const t of RESTORE_TABLES) {
      const rows = parsed[t];
      if (!Array.isArray(rows) || rows.length === 0) {
        summary[t] = 0;
        continue;
      }
      const { error } = await supabaseAdmin.from(t).upsert(rows as any, { onConflict: "id" });
      if (error) throw new Error(`Erro restaurando ${t}: ${error.message}`);
      summary[t] = rows.length;
    }
    return { ok: true, summary };
  });
