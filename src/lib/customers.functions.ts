import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  full_name: z.string().min(1),
  cpf_cnpj: z.string().min(11),
  phone: z.string().optional().nullable(),
  address_zip: z.string().optional().nullable(),
  address_street: z.string().optional().nullable(),
  address_number: z.string().optional().nullable(),
  address_complement: z.string().optional().nullable(),
  address_neighborhood: z.string().optional().nullable(),
  address_city: z.string().optional().nullable(),
  address_state: z.string().optional().nullable(),
});

export const createCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) {
      throw new Response("Forbidden", { status: 403 });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL!;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const admin = createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: created, error } = await admin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error) throw new Response(error.message, { status: 400 });

    const newUserId = created.user?.id;
    if (newUserId) {
      const { error: profileError } = await admin.from("profiles").upsert({
        user_id: newUserId,
        email: data.email,
        full_name: data.full_name,
        cpf_cnpj: data.cpf_cnpj.replace(/\D/g, ""),
        phone: data.phone ?? null,
        address_zip: data.address_zip ?? null,
        address_street: data.address_street ?? null,
        address_number: data.address_number ?? null,
        address_complement: data.address_complement ?? null,
        address_neighborhood: data.address_neighborhood ?? null,
        address_city: data.address_city ?? null,
        address_state: data.address_state ?? null,
      }, { onConflict: "user_id" });
      if (profileError) {
        await admin.auth.admin.deleteUser(newUserId);
        throw new Response(profileError.message, { status: 400 });
      }

      const { error: roleError } = await admin.from("user_roles").upsert(
        { user_id: newUserId, role: "client" },
        { onConflict: "user_id,role" }
      );
      if (roleError) {
        await admin.auth.admin.deleteUser(newUserId);
        throw new Response(roleError.message, { status: 400 });
      }
    }
    return { user_id: newUserId };
  });

export const listAdminProfiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Response("Forbidden", { status: 403 });

    const admin = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const [{ data: profiles, error: profilesError }, { data: usersData, error: usersError }] = await Promise.all([
      admin.from("profiles").select("user_id, full_name, email"),
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);

    if (profilesError) throw new Response(profilesError.message, { status: 400 });
    if (usersError) throw new Response(usersError.message, { status: 400 });

    const profileByUserId = new Map((profiles ?? []).map((p) => [p.user_id, p]));

    return usersData.users.map((user) => {
      const profile = profileByUserId.get(user.id);
      return {
        user_id: user.id,
        full_name: profile?.full_name ?? (typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null),
        email: profile?.email ?? user.email ?? null,
      };
    });
  });
