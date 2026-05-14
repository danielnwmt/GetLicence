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
