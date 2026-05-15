import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function admin() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

function clientIp(request: Request): string | null {
  const h = request.headers;
  return (
    h.get("cf-connecting-ip") ||
    h.get("x-real-ip") ||
    (h.get("x-forwarded-for") || "").split(",")[0].trim() ||
    null
  );
}

function isIPv6(ip: string | null | undefined): boolean {
  return !!ip && ip.includes(":");
}
function isIPv4(ip: string | null | undefined): boolean {
  return !!ip && /^\d{1,3}(\.\d{1,3}){3}$/.test(ip);
}

async function handle(
  request: Request,
  params: { license_key?: string; hostname?: string; ipv4?: string; ipv6?: string },
) {
  const sb = admin();
  const key = (params.license_key || "").trim().toUpperCase();
  if (!key) return Response.json({ ok: false, status: "invalid", reason: "missing license_key" }, { status: 400 });

  const { data: lic, error } = await sb
    .from("licenses")
    .select("id, status, expires_at, activated_at, user_id, product_id, products:product_id(storage_amount, storage_unit, vps_storage_amount, vps_storage_unit)")
    .eq("license_key", key)
    .maybeSingle();

  if (error || !lic) {
    return Response.json({ ok: false, status: "invalid", reason: "license not found" }, { status: 404 });
  }

  const ip = clientIp(request);
  const ipv4 = params.ipv4 || (isIPv4(ip) ? ip! : null);
  const ipv6 = params.ipv6 || (isIPv6(ip) ? ip! : null);
  const now = new Date();
  const expired = new Date(lic.expires_at) < now;

  let newStatus = lic.status;
  const update: Database["public"]["Tables"]["licenses"]["Update"] = {
    last_seen_at: now.toISOString(),
    device_ip: ip,
    device_ip_v4: ipv4,
    device_ip_v6: ipv6,
    device_hostname: params.hostname ?? null,
  };

  // Auto-activate on first valid contact (pending → active) if not expired
  if (lic.status === "pending" && !expired) {
    newStatus = "active";
    update.status = "active";
    update.activated_at = lic.activated_at ?? now.toISOString();
  }

  // If expired, mark expired
  if (expired && lic.status !== "expired" && lic.status !== "cancelled") {
    newStatus = "expired";
    update.status = "expired";
  }

  await sb.from("licenses").update(update).eq("id", lic.id);

  const allowed = newStatus === "active";
  const prod: any = (lic as any).products ?? null;
  return Response.json({
    ok: allowed,
    status: newStatus,
    expires_at: lic.expires_at,
    blocked: newStatus === "blocked",
    expired: newStatus === "expired",
    storage: prod ? {
      amount: Number(prod.storage_amount ?? 0),
      unit: prod.storage_unit ?? "GB",
      vps_amount: Number(prod.vps_storage_amount ?? 0),
      vps_unit: prod.vps_storage_unit ?? "GB",
    } : null,
  });
}

export const Route = createFileRoute("/api/public/license/check")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: any = {};
        try { body = await request.json(); } catch {}
        return handle(request, { license_key: body?.license_key, hostname: body?.hostname });
      },
      GET: async ({ request }) => {
        const u = new URL(request.url);
        return handle(request, {
          license_key: u.searchParams.get("license_key") ?? undefined,
          hostname: u.searchParams.get("hostname") ?? undefined,
        });
      },
    },
  },
});
