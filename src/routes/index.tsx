import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { KeyRound, ShieldCheck, CreditCard, BarChart3, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GetLicence — Gerencie licenças e pagamentos" },
      { name: "description", content: "Plataforma para emitir, controlar e cobrar licenças de software com renovação automática e portal do cliente." },
    ],
  }),
  component: Index,
});

const emailSchema = z.string().trim().email("E-mail inválido").max(255);
const passwordSchema = z.string().min(6, "Mínimo 6 caracteres").max(72);

function Index() {
  return (
    <div className="min-h-screen">
      {/* Hero com login no quadrado direito */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero opacity-95" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_oklch(1_0_0_/_0.15),_transparent_60%)]" />
        <div className="relative container mx-auto grid gap-12 px-4 py-24 md:grid-cols-2 md:items-center md:py-32">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur">
              <Sparkles className="h-3 w-3" /> Sistema completo de licenciamento
            </div>
            <h1 className="mt-6 text-5xl font-bold tracking-tight text-white md:text-6xl">
              Gerencie licenças <br />
              <span className="text-white/80">e pagamentos</span> sem dor.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-white/80">
              Emita chaves de licença, controle expiração, renove assinaturas e
              acompanhe pagamentos em um painel limpo e poderoso.
            </p>
          </div>

          <div className="w-full justify-self-end md:max-w-md">
            <LoginCard />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Tudo que você precisa</h2>
          <p className="mt-4 text-muted-foreground">Da emissão da chave ao recibo do pagamento.</p>
        </div>
        <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: KeyRound, title: "Chaves de licença", desc: "Geração automática com validade e plano (mensal/anual)." },
            { icon: ShieldCheck, title: "Controle de acesso", desc: "Perfis admin e cliente com permissões separadas." },
            { icon: CreditCard, title: "Pagamentos", desc: "Registre cobranças, marque como pago e mantenha o histórico." },
            { icon: BarChart3, title: "Painel admin", desc: "Visão completa de clientes, licenças e receita." },
          ].map((f) => (
            <Card key={f.title} className="bg-gradient-card p-6 transition-all hover:shadow-elevated">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      <footer className="border-t border-border/60 py-8 text-center text-sm text-muted-foreground">
        GetLicence — feito com Lovable
      </footer>
    </div>
  );
}

function LoginCard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

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
    <div className="rounded-2xl border border-white/20 bg-white/10 p-8 shadow-elevated backdrop-blur-xl">
      <Link to="/" className="mb-6 flex items-center gap-2 text-white">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/15 backdrop-blur">
          <KeyRound className="h-5 w-5" />
        </div>
        <span className="text-xl font-semibold">GetLicence</span>
      </Link>
      <div className="mb-6 text-white">
        <h2 className="text-2xl font-semibold">Entrar</h2>
        <p className="text-sm text-white/80">Acesse sua conta para gerenciar licenças</p>
      </div>
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
    </div>
  );
}
