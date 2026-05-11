import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KeyRound, Calendar, CreditCard, Package, Copy, Check, FileText } from "lucide-react";
import { formatBRL, formatDate, statusLabel } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Minhas licenças — LicençaHub" }] }),
  component: Dashboard,
});

interface License {
  id: string;
  license_key: string;
  plan: string;
  status: string;
  starts_at: string;
  expires_at: string;
  product: { name: string; description: string | null } | null;
}

interface Payment {
  id: string;
  amount: number;
  status: string;
  method: string | null;
  paid_at: string | null;
  created_at: string;
  boleto_url: string | null;
  invoice_url: string | null;
  barcode: string | null;
  license: { license_key: string } | null;
}

function Dashboard() {
  const { user } = useAuth();
  const [licenses, setLicenses] = useState<License[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: lic } = await supabase
        .from("licenses")
        .select("id, license_key, plan, status, starts_at, expires_at, product:products(name, description)")
        .order("created_at", { ascending: false });
      setLicenses((lic as unknown as License[]) || []);

      const { data: pay } = await supabase
        .from("payments")
        .select("id, amount, status, method, paid_at, created_at, boleto_url, invoice_url, barcode, license:licenses(license_key)")
        .order("created_at", { ascending: false });
      setPayments((pay as unknown as Payment[]) || []);
    })();
  }, [user]);

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopied(key);
    toast.success("Chave copiada");
    setTimeout(() => setCopied(null), 1500);
  };

  const statusVariant: Record<string, string> = {
    active: "bg-success/15 text-success border-success/30",
    pending: "bg-warning/15 text-warning-foreground border-warning/30",
    expired: "bg-muted text-muted-foreground border-border",
    cancelled: "bg-destructive/15 text-destructive border-destructive/30",
    paid: "bg-success/15 text-success border-success/30",
    failed: "bg-destructive/15 text-destructive border-destructive/30",
    refunded: "bg-muted text-muted-foreground border-border",
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Minhas licenças</h1>
        <p className="text-muted-foreground">Suas chaves ativas e histórico de pagamentos.</p>
      </div>

      <section>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <KeyRound className="h-4 w-4" /> Licenças
        </h2>
        {licenses.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            <Package className="mx-auto mb-2 h-8 w-8 opacity-50" />
            Você ainda não possui licenças. Entre em contato com o administrador.
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {licenses.map((l) => (
              <Card key={l.id} className="bg-gradient-card p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">{l.product?.name ?? "Software"}</div>
                    <div className="mt-1 font-mono text-lg font-semibold">{l.license_key}</div>
                  </div>
                  <Badge className={statusVariant[l.status]} variant="outline">{statusLabel[l.status]}</Badge>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Expira em {formatDate(l.expires_at)}</span>
                  <span className="capitalize">{l.plan === "monthly" ? "Mensal" : "Anual"}</span>
                </div>
                <Button size="sm" variant="outline" className="mt-4" onClick={() => copyKey(l.license_key)}>
                  {copied === l.license_key ? <Check className="mr-2 h-3.5 w-3.5" /> : <Copy className="mr-2 h-3.5 w-3.5" />}
                  Copiar chave
                </Button>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <CreditCard className="h-4 w-4" /> Pagamentos
        </h2>
        {payments.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">Nenhum pagamento registrado.</Card>
        ) : (
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-3 font-medium">Data</th>
                  <th className="p-3 font-medium">Licença</th>
                  <th className="p-3 font-medium">Valor</th>
                  <th className="p-3 font-medium">Método</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium">2ª via</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="p-3">{formatDate(p.created_at)}</td>
                    <td className="p-3 font-mono text-xs">{p.license?.license_key ?? "—"}</td>
                    <td className="p-3 font-medium">{formatBRL(Number(p.amount))}</td>
                    <td className="p-3">{p.method ?? "—"}</td>
                    <td className="p-3"><Badge className={statusVariant[p.status]} variant="outline">{statusLabel[p.status]}</Badge></td>
                    <td className="p-3">
                      {p.boleto_url || p.invoice_url ? (
                        <a
                          href={p.boleto_url || p.invoice_url || "#"}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          <FileText className="h-3.5 w-3.5" /> Baixar boleto
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>
    </div>
  );
}
