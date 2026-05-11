import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Provider = "asaas" | "sicredi" | "sicoob" | "manual";

export const getPaymentSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("payment_settings")
      .select("*")
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);

    // Report which provider credentials are configured (server-side only)
    const secretStatus = {
      asaas: !!process.env.ASAAS_API_KEY,
      sicredi:
        !!process.env.SICREDI_CLIENT_ID &&
        !!process.env.SICREDI_CLIENT_SECRET &&
        !!process.env.SICREDI_CERT_PEM,
      sicoob:
        !!process.env.SICOOB_CLIENT_ID &&
        !!process.env.SICOOB_ACCESS_TOKEN &&
        !!process.env.SICOOB_CERT_PEM,
    };

    return { settings: data, secretStatus };
  });

export const updatePaymentSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      id: string;
      active_provider: Provider;
      asaas_env: "sandbox" | "production";
      notes?: string | null;
    }) => data,
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("payment_settings")
      .update({
        active_provider: data.active_provider,
        asaas_env: data.asaas_env,
        notes: data.notes ?? null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
