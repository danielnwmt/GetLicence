import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { KeyRound, ShieldCheck, CreditCard, BarChart3, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LicençaHub — Gerencie licenças e pagamentos" },
      { name: "description", content: "Plataforma para emitir, controlar e cobrar licenças de software com renovação automática e portal do cliente." },
      { property: "og:title", content: "LicençaHub — Gerencie licenças e pagamentos" },
      { property: "og:description", content: "Emita chaves, controle expiração e cobre licenças em um só lugar." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero opacity-95" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_oklch(1_0_0_/_0.15),_transparent_60%)]" />
        <div className="relative container mx-auto px-4 py-24 md:py-32">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur">
              <Sparkles className="h-3 w-3" /> Sistema completo de licenciamento
            </div>
            <h1 className="mt-6 text-5xl font-bold tracking-tight text-white md:text-6xl lg:text-7xl">
              Gerencie licenças <br />
              <span className="text-white/80">e pagamentos</span> sem dor.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-white/80">
              Emita chaves de licença, controle expiração, renove assinaturas e
              acompanhe pagamentos em um painel limpo e poderoso.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Button asChild size="lg" variant="secondary" className="shadow-elevated">
                <Link to="/auth">Criar conta gratuita</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white">
                <Link to="/dashboard">Acessar painel</Link>
              </Button>
            </div>
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
        LicençaHub — feito com Lovable
      </footer>
    </div>
  );
}
