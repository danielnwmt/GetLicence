import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  full_name: z.string().min(1),
  role: z.enum(["admin", "operator"]).default("admin"),
});

export const createSystemUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Response("Forbidden", { status: 403 });

    const admin = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: created, error } = await admin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error) throw new Response(error.message, { status: 400 });

    const newUserId = created.user?.id;
    if (newUserId) {
      const { error: pErr } = await admin
        .from("profiles")
        .upsert(
          { user_id: newUserId, email: data.email, full_name: data.full_name },
          { onConflict: "user_id" },
        );
      if (pErr) {
        await admin.auth.admin.deleteUser(newUserId);
        throw new Response(pErr.message, { status: 400 });
      }
      // Remove default client role and assign admin (+ operator if requested)
      await admin.from("user_roles").delete().eq("user_id", newUserId);
      const { error: rErr } = await admin
        .from("user_roles")
        .insert([{ user_id: newUserId, role: "admin" }]);
      if (rErr) {
        await admin.auth.admin.deleteUser(newUserId);
        throw new Response(rErr.message, { status: 400 });
      }
      if (data.role === "operator") {
        // tolerate missing 'operator' enum on older local installs
        await admin.from("user_roles").insert([{ user_id: newUserId, role: "operator" as any }]);
      }
    }
    return { user_id: newUserId };
  });

export const listSystemUsers = createServerFn({ method: "GET" })
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
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: adminRoles, error: adminErr } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    if (adminErr) throw new Response(adminErr.message, { status: 400 });
    const adminIds = Array.from(new Set((adminRoles ?? []).map((r: any) => r.user_id)));
    if (adminIds.length === 0) return [];

    // operator enum may not exist on older local installs; tolerate failure
    let operatorSet = new Set<string>();
    try {
      const { data: opRoles } = await admin
        .from("user_roles")
        .select("user_id")
        .eq("role", "operator" as any);
      operatorSet = new Set((opRoles ?? []).map((r: any) => r.user_id));
    } catch {
      /* operator role not supported */
    }

    const { data: profiles, error: profErr } = await admin
      .from("profiles")
      .select("user_id, full_name, email")
      .in("user_id", adminIds);
    if (profErr) throw new Response(profErr.message, { status: 400 });
    return (profiles ?? []).map((p) => ({
      ...p,
      role: operatorSet.has(p.user_id) ? "operator" : "admin",
    }));
  });

const updateSchema = z.object({
  user_id: z.string().uuid(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  full_name: z.string().min(1).optional(),
  role: z.enum(["admin", "operator"]).optional(),
});

export const updateSystemUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Response("Forbidden", { status: 403 });

    const admin = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const attrs: { email?: string; password?: string } = {};
    if (data.email) attrs.email = data.email;
    if (data.password) attrs.password = data.password;
    if (Object.keys(attrs).length > 0) {
      const { error } = await admin.auth.admin.updateUserById(data.user_id, attrs);
      if (error) throw new Response(error.message, { status: 400 });
    }

    if (data.email || data.full_name) {
      const patch: { email?: string; full_name?: string } = {};
      if (data.email) patch.email = data.email;
      if (data.full_name) patch.full_name = data.full_name;
      await admin.from("profiles").update(patch).eq("user_id", data.user_id);
    }

    if (data.role) {
      // Reset to base admin role and add operator if requested
      await admin.from("user_roles").delete().eq("user_id", data.user_id);
      const rolesToInsert: { user_id: string; role: "admin" | "operator" }[] = [
        { user_id: data.user_id, role: "admin" },
      ];
      if (data.role === "operator") rolesToInsert.push({ user_id: data.user_id, role: "operator" });
      await admin.from("user_roles").insert(rolesToInsert);
    }

    return { ok: true };
  });

export const deleteSystemUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Response("Forbidden", { status: 403 });
    if (data.user_id === userId) {
      throw new Response("Você não pode excluir o próprio usuário", { status: 400 });
    }

    const admin = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { error } = await admin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });
