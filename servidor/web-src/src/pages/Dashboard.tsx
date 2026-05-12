import { useQuery } from "@tanstack/react-query";
import { api, type License, type Payment } from "../api";
import { Badge, Card, fmtBRL, fmtDate } from "../ui";

export function DashboardPage() {
  const licenses = useQuery({ queryKey: ["my-licenses"], queryFn: () => api.get<{ licenses: License[] }>("/api/licenses") });
  const payments = useQuery({ queryKey: ["my-payments"], queryFn: () => api.get<{ payments: Payment[] }>("/api/payments") });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Meu painel</h1>

      <Card>
        <h2 className="font-semibold mb-3">Minhas licenças</h2>
        {licenses.isLoading ? <p>Carregando…</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500 border-b">
                <tr><th className="py-2">Produto</th><th>Chave</th><th>Plano</th><th>Status</th><th>Expira</th></tr>
              </thead>
              <tbody>
                {(licenses.data?.licenses ?? []).map((l) => (
                  <tr key={l.id} className="border-b last:border-0">
                    <td className="py-2">{l.product_name ?? "—"}</td>
                    <td className="font-mono text-xs">{l.license_key}</td>
                    <td>{l.plan === "monthly" ? "Mensal" : "Anual"}</td>
                    <td><StatusBadge status={l.status} /></td>
                    <td>{fmtDate(l.expires_at)}</td>
                  </tr>
                ))}
                {(licenses.data?.licenses ?? []).length === 0 && <tr><td colSpan={5} className="py-4 text-slate-400">Nenhuma licença.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="font-semibold mb-3">Meus pagamentos</h2>
        {payments.isLoading ? <p>Carregando…</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500 border-b">
                <tr><th className="py-2">Valor</th><th>Status</th><th>Vencimento</th><th>Pago em</th><th>Referência</th></tr>
              </thead>
              <tbody>
                {(payments.data?.payments ?? []).map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-2">{fmtBRL(p.amount)}</td>
                    <td><PayBadge status={p.status} /></td>
                    <td>{fmtDate(p.due_date)}</td>
                    <td>{fmtDate(p.paid_at)}</td>
                    <td className="text-xs text-slate-500">{p.reference ?? "—"}</td>
                  </tr>
                ))}
                {(payments.data?.payments ?? []).length === 0 && <tr><td colSpan={5} className="py-4 text-slate-400">Nenhum pagamento.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: License["status"] }) {
  const map = { active: "green", pending: "yellow", expired: "red", cancelled: "slate" } as const;
  const label = { active: "Ativa", pending: "Pendente", expired: "Expirada", cancelled: "Cancelada" }[status];
  return <Badge color={map[status]}>{label}</Badge>;
}
function PayBadge({ status }: { status: Payment["status"] }) {
  const map = { paid: "green", pending: "yellow", failed: "red", refunded: "slate" } as const;
  const label = { paid: "Pago", pending: "Pendente", failed: "Falhou", refunded: "Estornado" }[status];
  return <Badge color={map[status]}>{label}</Badge>;
}
