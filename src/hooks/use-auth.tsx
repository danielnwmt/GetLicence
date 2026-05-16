import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserRole } from "@/lib/auth.functions";

type Role = "admin" | "client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: Role | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const getCurrentUserRoleFn = useServerFn(getCurrentUserRole);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const applySession = async (sess: Session | null) => {
      if (!mounted) return;
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        await fetchRole(sess.user.id);
      } else {
        setRole(null);
      }
      if (mounted) setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      void applySession(sess);
    });

    supabase.auth.getSession().then(({ data }) => applySession(data.session));

    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  const fetchRole = async (userId: string) => {
    try {
      const serverRole = await getCurrentUserRoleFn();
      setRole(serverRole);
      return;
    } catch (e) {
      console.error("Role fetch failed:", e);
    }

    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isAdmin = (data ?? []).some((r: { role: string }) => r.role === "admin");
    if (!isAdmin && userId) {
      setRole("client");
      return;
    }
    setRole(isAdmin ? "admin" : "client");
  };

  const signOut = async () => {
    setRole(null);
    setUser(null);
    setSession(null);
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch (e) {
      console.error("signOut failed:", e);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, role, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
