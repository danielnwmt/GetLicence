// Server-only backup helpers: Google Drive upload via Service Account JWT
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TABLES = [
  "profiles",
  "user_roles",
  "products",
  "licenses",
  "payments",
  "payables",
  "payment_settings",
] as const;

function b64url(input: ArrayBuffer | Uint8Array | string) {
  let bytes: Uint8Array;
  if (typeof input === "string") bytes = new TextEncoder().encode(input);
  else if (input instanceof Uint8Array) bytes = input;
  else bytes = new Uint8Array(input);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const clean = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(clean);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

async function getAccessToken(sa: { client_email: string; private_key: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/drive.file",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${b64url(sig)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`Google OAuth falhou (${res.status}): ${await res.text()}`);
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

async function exportAllTables(): Promise<Record<string, unknown[]>> {
  const out: Record<string, unknown[]> = {};
  for (const t of TABLES) {
    const { data, error } = await supabaseAdmin.from(t).select("*");
    if (error) throw new Error(`Erro lendo ${t}: ${error.message}`);
    out[t] = data ?? [];
  }
  return out;
}

async function uploadToDrive(
  accessToken: string,
  folderId: string,
  filename: string,
  jsonContent: string,
): Promise<string> {
  const boundary = `----lovbnd${Math.random().toString(36).slice(2)}`;
  const metadata = { name: filename, parents: [folderId], mimeType: "application/json" };
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
    `${jsonContent}\r\n` +
    `--${boundary}--`;
  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  if (!res.ok) throw new Error(`Drive upload falhou (${res.status}): ${await res.text()}`);
  const json = (await res.json()) as { id: string };
  return json.id;
}

async function deleteOldBackups(accessToken: string, folderId: string, retentionDays: number) {
  const cutoff = new Date(Date.now() - retentionDays * 86400_000).toISOString();
  const q = encodeURIComponent(
    `'${folderId}' in parents and trashed = false and name contains 'backup-' and createdTime < '${cutoff}'`,
  );
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,createdTime)&pageSize=100`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) return 0;
  const { files = [] } = (await res.json()) as { files: { id: string }[] };
  let deleted = 0;
  for (const f of files) {
    const d = await fetch(`https://www.googleapis.com/drive/v3/files/${f.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (d.ok) deleted++;
  }
  return deleted;
}

export async function runBackup(): Promise<{ ok: boolean; fileId?: string; deleted?: number; error?: string }> {
  try {
    const { data: cfg, error } = await supabaseAdmin
      .from("payment_settings")
      .select("id, gdrive_service_account_json, gdrive_folder_id, backup_retention_days, backup_enabled")
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!cfg) throw new Error("payment_settings não configurado");
    if (!cfg.gdrive_service_account_json || !cfg.gdrive_folder_id) {
      throw new Error("Configure a Service Account e a pasta do Google Drive");
    }

    let sa: { client_email: string; private_key: string };
    try {
      sa = JSON.parse(cfg.gdrive_service_account_json);
    } catch {
      throw new Error("JSON da Service Account inválido");
    }
    if (!sa.client_email || !sa.private_key) throw new Error("Service Account sem client_email/private_key");

    const token = await getAccessToken(sa);
    const dump = await exportAllTables();
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `backup-${stamp}.json`;
    const fileId = await uploadToDrive(token, cfg.gdrive_folder_id, filename, JSON.stringify(dump));
    const deleted = await deleteOldBackups(token, cfg.gdrive_folder_id, cfg.backup_retention_days || 5);

    await supabaseAdmin
      .from("payment_settings")
      .update({
        backup_last_run_at: new Date().toISOString(),
        backup_last_status: `ok (${deleted} antigos removidos)`,
        backup_last_file_id: fileId,
      })
      .eq("id", cfg.id);

    return { ok: true, fileId, deleted };
  } catch (e: any) {
    const msg = e?.message || String(e);
    try {
      const { data: cfg } = await supabaseAdmin.from("payment_settings").select("id").limit(1).maybeSingle();
      if (cfg?.id) {
        await supabaseAdmin
          .from("payment_settings")
          .update({ backup_last_run_at: new Date().toISOString(), backup_last_status: `erro: ${msg}` })
          .eq("id", cfg.id);
      }
    } catch {}
    return { ok: false, error: msg };
  }
}
