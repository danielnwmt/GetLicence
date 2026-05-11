import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({ payment_id: z.string().uuid() });

interface AsaasCustomer { id: string }
interface AsaasPayment {
  id: string;
  bankSlipUrl?: string;
  invoiceUrl?: string;
  identificationField?: string;
  nossoNumero?: string;
  status?: string;
  dueDate?: string;
}

async function asaasFetch(env: string, apiKey: string, path: string, init?: RequestInit) {
  const base = env === "production" ? "https://api.asaas.com" : "https://api-sandbox.asaas.com";
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      access_token: apiKey,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Asaas ${res.status}: ${text}`);
  }
  return res.json();
}

export const issueAsaasBoleto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Response("Forbidden", { status: 403 });

    const { data: settings, error: sErr } = await supabase
      .from("payment_settings")
      .select("active_provider, asaas_env, asaas_api_key")
      .limit(1)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!settings?.asaas_api_key) throw new Error("Configure a API Key do Asaas em Integrações.");

    const { data: payment, error: pErr } = await supabase
      .from("payments")
      .select("id, amount, user_id, due_date, status")
      .eq("id", data.payment_id)
      .single();
    if (pErr || !payment) throw new Error(pErr?.message || "Pagamento não encontrado");

    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("full_name, email, cpf_cnpj, phone, address_zip, address_street, address_number, address_complement, address_neighborhood, address_city, address_state")
      .eq("user_id", payment.user_id)
      .single();
    if (profErr || !profile) throw new Error("Perfil do cliente não encontrado");
    if (!profile.cpf_cnpj) throw new Error("Cliente sem CPF/CNPJ cadastrado.");

    const env = settings.asaas_env || "sandbox";
    const apiKey = settings.asaas_api_key;
    const cpfCnpj = profile.cpf_cnpj.replace(/\D/g, "");

    // Find or create customer in Asaas
    const found = await asaasFetch(env, apiKey, `/v3/customers?cpfCnpj=${cpfCnpj}`);
    let customer: AsaasCustomer | undefined = found?.data?.[0];
    if (!customer) {
      customer = await asaasFetch(env, apiKey, "/v3/customers", {
        method: "POST",
        body: JSON.stringify({
          name: profile.full_name || profile.email,
          email: profile.email,
          cpfCnpj,
          mobilePhone: profile.phone || undefined,
          postalCode: profile.address_zip || undefined,
          address: profile.address_street || undefined,
          addressNumber: profile.address_number || undefined,
          complement: profile.address_complement || undefined,
          province: profile.address_neighborhood || undefined,
        }),
      });
    }

    const dueDate = payment.due_date || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const charge: AsaasPayment = await asaasFetch(env, apiKey, "/v3/payments", {
      method: "POST",
      body: JSON.stringify({
        customer: customer!.id,
        billingType: "BOLETO",
        value: Number(payment.amount),
        dueDate,
        description: `Pagamento ${payment.id}`,
        externalReference: payment.id,
      }),
    });

    const { error: uErr } = await supabase
      .from("payments")
      .update({
        provider: "asaas",
        method: "BOLETO",
        provider_charge_id: charge.id,
        boleto_url: charge.bankSlipUrl ?? null,
        invoice_url: charge.invoiceUrl ?? null,
        barcode: charge.identificationField ?? null,
        due_date: dueDate,
        reference: charge.nossoNumero ?? null,
      })
      .eq("id", payment.id);
    if (uErr) throw new Error(uErr.message);

    return {
      ok: true,
      boleto_url: charge.bankSlipUrl,
      invoice_url: charge.invoiceUrl,
      barcode: charge.identificationField,
    };
  });
