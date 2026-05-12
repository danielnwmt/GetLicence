// Cliente único para a API local /api/*
async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : ({} as any);
  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

export const api = {
  get:  <T,>(p: string) => request<T>("GET", p),
  post: <T,>(p: string, b?: unknown) => request<T>("POST", p, b),
  put:  <T,>(p: string, b?: unknown) => request<T>("PUT", p, b),
  del:  <T,>(p: string) => request<T>("DELETE", p),
};

// Tipos compartilhados
export type Role = "admin" | "client";
export interface Me {
  user: {
    id: string; email: string; full_name?: string | null; cpf_cnpj?: string | null;
    phone?: string | null; address_zip?: string | null; address_street?: string | null;
    address_number?: string | null; address_complement?: string | null;
    address_neighborhood?: string | null; address_city?: string | null; address_state?: string | null;
  } | null;
  role: Role;
}
export interface Customer {
  user_id: string; full_name: string; email: string; cpf_cnpj?: string | null;
  phone?: string | null; address_city?: string | null; address_state?: string | null;
  created_at: string;
}
export interface Product {
  id: string; name: string; description?: string | null; price_monthly: number; price_yearly: number;
  active: boolean;
}
export interface License {
  id: string; user_id: string; product_id: string; license_key: string;
  plan: "monthly" | "yearly"; status: "pending" | "active" | "expired" | "cancelled";
  starts_at: string; expires_at: string; auto_renew: boolean; notes?: string | null;
  product_name?: string; customer_name?: string; customer_email?: string;
}
export interface Payment {
  id: string; user_id: string; license_id: string; amount: number; method?: string | null;
  status: "pending" | "paid" | "failed" | "refunded"; due_date?: string | null;
  paid_at?: string | null; reference?: string | null; notes?: string | null;
  customer_name?: string;
  created_at: string;
}
