import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api, type License, type Payment } from "../api";
import { Badge, Card, fmtBRL, fmtDate, statusLabel } from "../ui";
import { KeyRound, Calendar, CreditCard, Package, Copy, Check, FileText } from "lucide-react";

export function DashboardPage() {
  const licenses = useQuery({ queryKey: ["my-licenses"], queryFn: () => api.get<{ licenses: License[] }>("/api/licenses") });
  const payments = useQuery({ queryKey: ["my-payments"], queryFn: () => api.get<{ payments: Payment[] }>("/api/payments") });
  const [copied, setCopied] = useState<string | null>(null);

  const copyKey = (k: string) => {
    navigator.clipboard.writeText(k);
    setCopied(k);
    setTimeout(() => setCopied(null), 1500);
  };

  const licList = licenses.data?.licenses ?? [];
  const payList = payments.data?.payments ?? [];

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
        {licenses.isLoading ? (
          <Card className="p-8 text-center text-muted-foreground">Carregando…</Card>
        ) : licList.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            <Package className="mx-auto mb-2 h-8 w-8 opacity-50" />
            Você ainda não possui licenças.
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {licList.map((l) => (
              <Card key={l.id} className="bg-gradient-card p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">{l.product_name ?? "Software"}</div>
                    <div className="mt-1 font-mono text-lg font-semibold">{l.license_key}</div>
                  </div>
                  <Badge color={l.status === "active" ? "green" : l.status === "pending" ? "yellow" : l.status === "cancelled" ? "red" : "slate"}>
                    {statusLabel[l.status] ?? l.status}
                  </Badge>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Expira em {fmtDate(l.expires_at)}</span>
                  <span>{l.plan === "monthly" ? "Mensal" : "Anual"}</span>
                </div>
                <button
                  onClick={() => copyKey(l.license_key)}
                  className="mt-4 inline-flex items-center rounded-md border border-input bg-background px-3 h-8 text-xs font-medium hover:bg-accent transition-colors"
                >
                  {copied === l.license_key ? <Check className="mr-2 h-3.5 w-3.5" /> : <Copy className="mr-2 h-3.5 w-3.5" />}
                  Copiar chave
                </button>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <CreditCard className="h-4 w-4" /> Pagamentos
        </h2>
        {payList.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">Nenhum pagamento registrado.</Card>
        ) : (
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-3 font-medium">Data</th>
                  <th className="p-3 font-medium">Valor</th>
                  <th className="p-3 font-medium">Método</th>
                  <th className="p-3 font-medium">Vencimento</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium">2ª via</th>
                </tr>
              </thead>
              <tbody>
                {payList.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="p-3">{fmtDate(p.created_at)}</td>
                    <td className="p-3 font-medium">{fmtBRL(p.amount)}</td>
                    <td className="p-3">{p.method ?? "—"}</td>
                    <td className="p-3">{fmtDate(p.due_date)}</td>
                    <td className="p-3">
                      <Badge color={p.status === "paid" ? "green" : p.status === "pending" ? "yellow" : p.status === "failed" ? "red" : "slate"}>
                        {statusLabel[p.status] ?? p.status}
                      </Badge>
                    </td>
                    <td className="p-3">
                      {p.reference ? (
                        <a href={p.reference} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                          <FileText className="h-3.5 w-3.5" /> Baixar
                        </a>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
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
