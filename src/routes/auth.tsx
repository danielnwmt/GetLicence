import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, Sparkles } from "lucide-react";
import { toast } from "sonner";
import authHero from "@/assets/auth-hero.png";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar — LicençaHub" }] }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email("E-mail inválido").max(255);
const passwordSchema = z.string().min(6, "Mínimo 6 caracteres").max(72);

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  return (
    <div
      className="relative flex min-h-screen items-center justify-end bg-cover bg-center px-4 py-12 md:px-24"
      style={{ backgroundImage: `url(${authHero})` }}
    >
      {/* Card de login posicionado sobre o espaço roxo vazio da imagem */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/20 bg-white/10 p-8 shadow-elevated backdrop-blur-xl">
        <Link to="/" className="mb-6 flex items-center gap-2 text-white">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/15 backdrop-blur">
            <KeyRound className="h-5 w-5" />
          </div>
          <span className="text-xl font-semibold">LicençaHub</span>
        </Link>
        <div className="mb-6 text-white">
          <h2 className="text-2xl font-semibold">Entrar</h2>
          <p className="text-sm text-white/80">
            Acesse sua conta para gerenciar licenças
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      emailSchema.parse(email);
      passwordSchema.parse(password);
    } catch (err) {
      if (err instanceof z.ZodError) return toast.error(err.issues[0].message);
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Bem-vindo de volta!");
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="li-email" className="text-white">E-mail</Label>
        <Input
          id="li-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="border-white/30 bg-white/10 text-white placeholder:text-white/60"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="li-pwd" className="text-white">Senha</Label>
        <Input
          id="li-pwd"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="border-white/30 bg-white/10 text-white placeholder:text-white/60"
        />
      </div>
      <Button type="submit" variant="secondary" className="w-full" disabled={busy}>
        {busy ? "Entrando..." : "Entrar"}
      </Button>
    </form>
  );
}
