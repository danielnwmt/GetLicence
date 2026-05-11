import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Provider = "asaas" | "sicredi" | "sicoob" | "manual";

function admin() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Map provider statuses → internal payment_status
function mapAsaasStatus(s: string): "paid" | "pending" | "failed" | "refunded" {
  const v = s.toUpperCase();
  if (["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(v)) return "paid";
  if (["REFUNDED", "CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE", "REFUND_REQUESTED"].includes(v)) return "refunded";
  if (["OVERDUE"].includes(v)) return "failed";
  return "pending";
}

function mapSicrediStatus(s: string): "paid" | "pending" | "failed" | "refunded" {
  const v = (s || "").toUpperCase();
  if (["LIQUIDADO", "PAGO", "CONCLUIDA"].includes(v)) return "paid";
  if (["BAIXADO", "CANCELADO"].includes(v)) return "failed";
  if (["DEVOLVIDO"].includes(v)) return "refunded";
  return "pending";
}

function mapSicoobStatus(s: string): "paid" | "pending" | "failed" | "refunded" {
  const v = (s || "").toUpperCase();
  if (["CONCLUIDA", "LIQUIDADO", "PAGO"].includes(v)) return "paid";
  if (["REMOVIDA_PELO_USUARIO_RECEBEDOR", "REMOVIDA_PELO_PSP"].includes(v)) return "failed";
  if (["DEVOLVIDO"].includes(v)) return "refunded";
  return "pending";
}

async function handleAsaas(payload: any, sb: ReturnType<typeof admin>) {
  const pay = payload?.payment;
  if (!pay?.id) return { ok: false, reason: "no payment id" };
  const status = mapAsaasStatus(pay.status || payload?.event || "");
  const paid_at = status === "paid" ? (pay.paymentDate || pay.clientPaymentDate || new Date().toISOString()) : null;

  // Try update by provider_charge_id; if not found, insert log row
  const { data: existing } = await sb
    .from("payments")
    .select("id")
    .eq("provider_charge_id", pay.id)
    .maybeSingle();

  if (existing) {
    await sb.from("payments").update({
      status,
      paid_at,
      method: pay.billingType ?? null,
      boleto_url: pay.bankSlipUrl ?? null,
    }).eq("id", existing.id);
  }
  return { ok: true, matched: !!existing };
}

async function handleSicredi(payload: any, sb: ReturnType<typeof admin>) {
  // Sicredi cobranças/PIX webhook
  const charges = payload?.pix || [payload];
  for (const c of charges) {
    const txid = c?.txid || c?.nossoNumero || c?.endToEndId;
    if (!txid) continue;
    const status = mapSicrediStatus(c?.status || (c?.valor ? "LIQUIDADO" : ""));
    const { data: existing } = await sb
      .from("payments")
      .select("id")
      .eq("provider_charge_id", txid)
      .maybeSingle();
    if (existing) {
      await sb.from("payments").update({
        status,
        paid_at: status === "paid" ? (c?.horario || new Date().toISOString()) : null,
      }).eq("id", existing.id);
    }
  }
  return { ok: true };
}

async function handleSicoob(payload: any, sb: ReturnType<typeof admin>) {
  const charges = payload?.pix || [payload];
  for (const c of charges) {
    const txid = c?.txid || c?.endToEndId;
    if (!txid) continue;
    const status = mapSicoobStatus(c?.status || (c?.valor ? "CONCLUIDA" : ""));
    const { data: existing } = await sb
      .from("payments")
      .select("id")
      .eq("provider_charge_id", txid)
      .maybeSingle();
    if (existing) {
      await sb.from("payments").update({
        status,
        paid_at: status === "paid" ? (c?.horario || new Date().toISOString()) : null,
      }).eq("id", existing.id);
    }
  }
  return { ok: true };
}

export const Route = createFileRoute("/api/public/webhooks/$provider")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const provider = params.provider as Provider;
        if (!["asaas", "sicredi", "sicoob"].includes(provider)) {
          return new Response("Invalid provider", { status: 400 });
        }

        const url = new URL(request.url);
        const token = url.searchParams.get("token") || request.headers.get("x-webhook-token") || "";

        const sb = admin();
        const { data: settings, error: sErr } = await sb
          .from("payment_settings")
          .select("webhook_token, active_provider")
          .limit(1)
          .maybeSingle();
        if (sErr || !settings) {
          return new Response("Settings not configured", { status: 500 });
        }
        if (!token || token !== settings.webhook_token) {
          return new Response("Unauthorized", { status: 401 });
        }

        let payload: any = {};
        try { payload = await request.json(); } catch { payload = {}; }

        try {
          let result;
          if (provider === "asaas") result = await handleAsaas(payload, sb);
          else if (provider === "sicredi") result = await handleSicredi(payload, sb);
          else result = await handleSicoob(payload, sb);

          // Log raw payload for debugging
          console.log(`[webhook:${provider}]`, JSON.stringify({ result, event: payload?.event }));

          return Response.json({ received: true, ...result });
        } catch (e) {
          console.error(`[webhook:${provider}] error`, e);
          return new Response("Processing error", { status: 500 });
        }
      },
      GET: async () => Response.json({ ok: true, hint: "POST your webhook payload here" }),
    },
  },
});
