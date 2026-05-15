import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AdminProfile = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  address_city: string | null;
  address_state: string | null;
  customer_number: number | null;
  cpf_cnpj: string | null;
  phone: string | null;
  address_zip: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_neighborhood: string | null;
};


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

    const { data: created, error } = await supabase.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error) throw new Response(error.message, { status: 400 });

    const newUserId = created.user?.id;
    if (newUserId) {
      const { error: profileError } = await supabase.from("profiles").upsert({
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
        await supabase.auth.admin.deleteUser(newUserId);
        throw new Response(profileError.message, { status: 400 });
      }

      const { error: roleError } = await supabase.from("user_roles").upsert(
        { user_id: newUserId, role: "client" },
        { onConflict: "user_id,role" }
      );
      if (roleError) {
        await supabase.auth.admin.deleteUser(newUserId);
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

    // admin client imported at top

    const [{ data: profiles, error: profilesError }, { data: usersData, error: usersError }] = await Promise.all([
      admin.from("profiles").select("user_id, full_name, email, address_city, address_state, customer_number, cpf_cnpj, phone, address_zip, address_street, address_number, address_complement, address_neighborhood"),
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);

    if (profilesError) throw new Response(profilesError.message, { status: 400 });
    if (usersError) throw new Response(usersError.message, { status: 400 });

    const profileByUserId = new Map((profiles ?? []).map((p) => [p.user_id, p]));

    return usersData.users.map((user) => {
      const profile = profileByUserId.get(user.id);
      return {
        user_id: user.id,
        customer_number: profile?.customer_number ?? null,
        full_name: profile?.full_name ?? (typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null),
        email: profile?.email ?? user.email ?? null,
        cpf_cnpj: profile?.cpf_cnpj ?? null,
        phone: profile?.phone ?? null,
        address_zip: profile?.address_zip ?? null,
        address_street: profile?.address_street ?? null,
        address_number: profile?.address_number ?? null,
        address_complement: profile?.address_complement ?? null,
        address_neighborhood: profile?.address_neighborhood ?? null,
        address_city: profile?.address_city ?? null,
        address_state: profile?.address_state ?? null,
      };
    });
  });

const updateSchema = z.object({
  user_id: z.string().uuid(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional().or(z.literal("")),
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

export const updateCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Response("Forbidden", { status: 403 });

    // admin client imported at top

    const authUpdate: { email?: string; password?: string } = {};
    if (data.email) authUpdate.email = data.email;
    if (data.password && data.password.length >= 6) authUpdate.password = data.password;
    if (Object.keys(authUpdate).length > 0) {
      const { error } = await admin.auth.admin.updateUserById(data.user_id, authUpdate);
      if (error) throw new Response(error.message, { status: 400 });
    }

    const { error: pErr } = await admin.from("profiles").update({
      full_name: data.full_name,
      email: data.email ?? undefined,
      cpf_cnpj: data.cpf_cnpj.replace(/\D/g, ""),
      phone: data.phone ?? null,
      address_zip: data.address_zip ?? null,
      address_street: data.address_street ?? null,
      address_number: data.address_number ?? null,
      address_complement: data.address_complement ?? null,
      address_neighborhood: data.address_neighborhood ?? null,
      address_city: data.address_city ?? null,
      address_state: data.address_state ?? null,
    }).eq("user_id", data.user_id);
    if (pErr) throw new Response(pErr.message, { status: 400 });

    return { ok: true };
  });
