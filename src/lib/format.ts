export const formatBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

export const formatDate = (d: string | Date) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(d));

export const statusLabel: Record<string, string> = {
  active: "Ativa",
  expired: "Expirada",
  cancelled: "Cancelada",
  pending: "Aguardando pagamento",
  blocked: "Bloqueada",
  paid: "Pago",
  failed: "Falhou",
  refunded: "Reembolsado",
};

export function paymentStatusLabel(p: {
  status: string;
  provider_charge_id?: string | null;
  boleto_url?: string | null;
}) {
  if (p.status === "pending" && !p.provider_charge_id && !p.boleto_url) {
    return "Aguardando emissão";
  }
  return statusLabel[p.status] ?? p.status;
}
