import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type Customer, type License, type Payment, type Product } from "../api";
import { Badge, Button, Card, Field, Input, Modal, Select, Textarea, fmtBRL, fmtDate } from "../ui";

type Tab = "customers" | "products" | "licenses" | "payments" | "settings";

export function AdminPage() {
  const [tab, setTab] = useState<Tab>("customers");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Administração</h1>
      <div className="flex gap-2 border-b">
        {[
          ["customers", "Clientes"],
          ["products", "Produtos"],
          ["licenses", "Licenças"],
          ["payments", "Pagamentos"],
          ["settings", "Pagamentos · Config"],
        ].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k as Tab)}
            className={`px-3 py-2 text-sm border-b-2 ${tab === k ? "border-blue-600 text-blue-700 font-medium" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >{label}</button>
        ))}
      </div>
      {tab === "customers" && <CustomersTab />}
      {tab === "products" && <ProductsTab />}
      {tab === "licenses" && <LicensesTab />}
      {tab === "payments" && <PaymentsTab />}
      {tab === "settings" && <SettingsTab />}
    </div>
  );
}

/* =================== CLIENTES =================== */
function CustomersTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["customers"], queryFn: () => api.get<{ customers: Customer[] }>("/api/customers") });
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});

  const create = useMutation({
    mutationFn: (body: any) => api.post("/api/customers", body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["customers"] }); setOpen(false); setForm({}); setErr(null); },
    onError: (e: Error) => setErr(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => api.del(`/api/customers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    create.mutate(form);
  }

  return (
    <Card>
      <div className="flex justify-between mb-3">
        <h2 className="font-semibold">Clientes ({data?.customers.length ?? 0})</h2>
        <Button onClick={() => { setForm({}); setErr(null); setOpen(true); }}>Novo cliente</Button>
      </div>
      {isLoading ? <p>Carregando…</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500 border-b">
              <tr><th className="py-2">Nome</th><th>Email</th><th>CPF/CNPJ</th><th>Cidade/UF</th><th></th></tr>
            </thead>
            <tbody>
              {(data?.customers ?? []).map((c) => (
                <tr key={c.user_id} className="border-b last:border-0">
                  <td className="py-2">{c.full_name}</td>
                  <td>{c.email}</td>
                  <td>{c.cpf_cnpj ?? "—"}</td>
                  <td>{c.address_city ?? "—"}{c.address_state ? `/${c.address_state}` : ""}</td>
                  <td>
                    <Button variant="ghost" onClick={() => { if (confirm(`Remover ${c.full_name}?`)) del.mutate(c.user_id); }}>Remover</Button>
                  </td>
                </tr>
              ))}
              {(data?.customers ?? []).length === 0 && <tr><td colSpan={5} className="py-4 text-slate-400">Nenhum cliente.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Novo cliente">
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Nome completo *"><Input required value={form.full_name ?? ""} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
          <Field label="Email *"><Input type="email" required value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Senha (mín. 8) *"><Input type="password" required minLength={8} value={form.password ?? ""} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
          <Field label="CPF/CNPJ *"><Input required value={form.cpf_cnpj ?? ""} onChange={(e) => setForm({ ...form, cpf_cnpj: e.target.value })} /></Field>
          <Field label="Telefone"><Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="CEP"><Input value={form.address_zip ?? ""} onChange={(e) => setForm({ ...form, address_zip: e.target.value })} /></Field>
          <Field label="Rua"><Input value={form.address_street ?? ""} onChange={(e) => setForm({ ...form, address_street: e.target.value })} /></Field>
          <Field label="Número"><Input value={form.address_number ?? ""} onChange={(e) => setForm({ ...form, address_number: e.target.value })} /></Field>
          <Field label="Bairro"><Input value={form.address_neighborhood ?? ""} onChange={(e) => setForm({ ...form, address_neighborhood: e.target.value })} /></Field>
          <Field label="Cidade"><Input value={form.address_city ?? ""} onChange={(e) => setForm({ ...form, address_city: e.target.value })} /></Field>
          <Field label="UF"><Input maxLength={2} value={form.address_state ?? ""} onChange={(e) => setForm({ ...form, address_state: e.target.value.toUpperCase() })} /></Field>
          {err && <div className="md:col-span-2 bg-red-50 text-red-700 p-2 text-sm rounded">{err}</div>}
          <div className="md:col-span-2 flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={create.isPending}>{create.isPending ? "Salvando…" : "Cadastrar"}</Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}

/* =================== PRODUTOS =================== */
function ProductsTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["products"], queryFn: () => api.get<{ products: Product[] }>("/api/products") });
  const [editing, setEditing] = useState<Partial<Product> | null>(null);

  const save = useMutation({
    mutationFn: async (p: Partial<Product>) => {
      const body = { ...p, price_monthly: Number(p.price_monthly ?? 0), price_yearly: Number(p.price_yearly ?? 0) };
      if (p.id) return api.put(`/api/products/${p.id}`, body);
      return api.post("/api/products", body);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); setEditing(null); },
  });
  const del = useMutation({ mutationFn: (id: string) => api.del(`/api/products/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }) });

  return (
    <Card>
      <div className="flex justify-between mb-3">
        <h2 className="font-semibold">Produtos</h2>
        <Button onClick={() => setEditing({ name: "", price_monthly: 0, price_yearly: 0, active: true })}>Novo produto</Button>
      </div>
      {isLoading ? <p>Carregando…</p> : (
        <table className="w-full text-sm">
          <thead className="text-left text-slate-500 border-b">
            <tr><th className="py-2">Nome</th><th>Mensal</th><th>Anual</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {(data?.products ?? []).map((p) => (
              <tr key={p.id} className="border-b last:border-0">
                <td className="py-2">{p.name}</td>
                <td>{fmtBRL(p.price_monthly)}</td>
                <td>{fmtBRL(p.price_yearly)}</td>
                <td>{p.active ? <Badge color="green">Ativo</Badge> : <Badge>Inativo</Badge>}</td>
                <td className="space-x-2">
                  <Button variant="ghost" onClick={() => setEditing(p)}>Editar</Button>
                  <Button variant="ghost" onClick={() => { if (confirm("Remover?")) del.mutate(p.id); }}>Remover</Button>
                </td>
              </tr>
            ))}
            {(data?.products ?? []).length === 0 && <tr><td colSpan={5} className="py-4 text-slate-400">Nenhum produto.</td></tr>}
          </tbody>
        </table>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Editar produto" : "Novo produto"}>
        {editing && (
          <form onSubmit={(e) => { e.preventDefault(); save.mutate(editing); }} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Nome *"><Input required value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
            <Field label="Ativo"><Select value={editing.active ? "1" : "0"} onChange={(e) => setEditing({ ...editing, active: e.target.value === "1" })}><option value="1">Sim</option><option value="0">Não</option></Select></Field>
            <Field label="Preço mensal (R$)"><Input type="number" step="0.01" value={editing.price_monthly ?? 0} onChange={(e) => setEditing({ ...editing, price_monthly: Number(e.target.value) })} /></Field>
            <Field label="Preço anual (R$)"><Input type="number" step="0.01" value={editing.price_yearly ?? 0} onChange={(e) => setEditing({ ...editing, price_yearly: Number(e.target.value) })} /></Field>
            <div className="md:col-span-2"><Field label="Descrição"><Textarea rows={3} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field></div>
            <div className="md:col-span-2 flex justify-end gap-2">
              <Button variant="secondary" type="button" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button type="submit" disabled={save.isPending}>{save.isPending ? "Salvando…" : "Salvar"}</Button>
            </div>
          </form>
        )}
      </Modal>
    </Card>
  );
}

/* =================== LICENÇAS =================== */
function LicensesTab() {
  const qc = useQueryClient();
  const licenses = useQuery({ queryKey: ["licenses"], queryFn: () => api.get<{ licenses: License[] }>("/api/licenses") });
  const customers = useQuery({ queryKey: ["customers"], queryFn: () => api.get<{ customers: Customer[] }>("/api/customers") });
  const products = useQuery({ queryKey: ["products"], queryFn: () => api.get<{ products: Product[] }>("/api/products") });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({ plan: "monthly", status: "pending" });

  const create = useMutation({
    mutationFn: (b: any) => api.post("/api/licenses", b),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["licenses"] }); setOpen(false); setForm({ plan: "monthly", status: "pending" }); },
  });
  const del = useMutation({ mutationFn: (id: string) => api.del(`/api/licenses/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ["licenses"] }) });

  return (
    <Card>
      <div className="flex justify-between mb-3">
        <h2 className="font-semibold">Licenças</h2>
        <Button onClick={() => setOpen(true)}>Nova licença</Button>
      </div>
      {licenses.isLoading ? <p>Carregando…</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500 border-b">
              <tr><th className="py-2">Cliente</th><th>Produto</th><th>Chave</th><th>Plano</th><th>Status</th><th>Expira</th><th></th></tr>
            </thead>
            <tbody>
              {(licenses.data?.licenses ?? []).map((l) => (
                <tr key={l.id} className="border-b last:border-0">
                  <td className="py-2">{l.customer_name ?? "—"}</td>
                  <td>{l.product_name ?? "—"}</td>
                  <td className="font-mono text-xs">{l.license_key}</td>
                  <td>{l.plan === "monthly" ? "Mensal" : "Anual"}</td>
                  <td>{l.status}</td>
                  <td>{fmtDate(l.expires_at)}</td>
                  <td><Button variant="ghost" onClick={() => { if (confirm("Remover?")) del.mutate(l.id); }}>Remover</Button></td>
                </tr>
              ))}
              {(licenses.data?.licenses ?? []).length === 0 && <tr><td colSpan={7} className="py-4 text-slate-400">Nenhuma licença.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Nova licença">
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(form); }} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Cliente *">
            <Select required value={form.user_id ?? ""} onChange={(e) => setForm({ ...form, user_id: e.target.value })}>
              <option value="">— selecione —</option>
              {(customers.data?.customers ?? []).map((c) => <option key={c.user_id} value={c.user_id}>{c.full_name} ({c.email})</option>)}
            </Select>
          </Field>
          <Field label="Produto *">
            <Select required value={form.product_id ?? ""} onChange={(e) => setForm({ ...form, product_id: e.target.value })}>
              <option value="">— selecione —</option>
              {(products.data?.products ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <Field label="Plano"><Select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}><option value="monthly">Mensal</option><option value="yearly">Anual</option></Select></Field>
          <Field label="Status"><Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="pending">Pendente</option><option value="active">Ativa</option><option value="expired">Expirada</option><option value="cancelled">Cancelada</option></Select></Field>
          <Field label="Expira em *"><Input type="date" required value={form.expires_at ?? ""} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} /></Field>
          <Field label="Renovação automática"><Select value={form.auto_renew ? "1" : "0"} onChange={(e) => setForm({ ...form, auto_renew: e.target.value === "1" })}><option value="1">Sim</option><option value="0">Não</option></Select></Field>
          <div className="md:col-span-2"><Field label="Observações"><Textarea rows={2} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field></div>
          <div className="md:col-span-2 flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={create.isPending}>{create.isPending ? "Salvando…" : "Criar"}</Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}

/* =================== PAGAMENTOS =================== */
function PaymentsTab() {
  const qc = useQueryClient();
  const payments = useQuery({ queryKey: ["payments-admin"], queryFn: () => api.get<{ payments: Payment[] }>("/api/payments") });
  const licenses = useQuery({ queryKey: ["licenses"], queryFn: () => api.get<{ licenses: License[] }>("/api/licenses") });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({ status: "pending" });

  const create = useMutation({
    mutationFn: (b: any) => api.post("/api/payments", { ...b, amount: Number(b.amount) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payments-admin"] }); setOpen(false); setForm({ status: "pending" }); },
  });
  const markPaid = useMutation({ mutationFn: (id: string) => api.put(`/api/payments/${id}/mark-paid`), onSuccess: () => qc.invalidateQueries({ queryKey: ["payments-admin"] }) });
  const del = useMutation({ mutationFn: (id: string) => api.del(`/api/payments/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ["payments-admin"] }) });

  return (
    <Card>
      <div className="flex justify-between mb-3">
        <h2 className="font-semibold">Pagamentos</h2>
        <Button onClick={() => setOpen(true)}>Novo pagamento</Button>
      </div>
      {payments.isLoading ? <p>Carregando…</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500 border-b">
              <tr><th className="py-2">Cliente</th><th>Valor</th><th>Status</th><th>Vencimento</th><th>Pago em</th><th></th></tr>
            </thead>
            <tbody>
              {(payments.data?.payments ?? []).map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="py-2">{p.customer_name ?? "—"}</td>
                  <td>{fmtBRL(p.amount)}</td>
                  <td>{p.status}</td>
                  <td>{fmtDate(p.due_date)}</td>
                  <td>{fmtDate(p.paid_at)}</td>
                  <td className="space-x-2">
                    {p.status !== "paid" && <Button variant="ghost" onClick={() => markPaid.mutate(p.id)}>Marcar pago</Button>}
                    <Button variant="ghost" onClick={() => { if (confirm("Remover?")) del.mutate(p.id); }}>Remover</Button>
                  </td>
                </tr>
              ))}
              {(payments.data?.payments ?? []).length === 0 && <tr><td colSpan={6} className="py-4 text-slate-400">Nenhum pagamento.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Novo pagamento">
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(form); }} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Licença *">
            <Select required value={form.license_id ?? ""} onChange={(e) => {
              const l = (licenses.data?.licenses ?? []).find((x) => x.id === e.target.value);
              setForm({ ...form, license_id: e.target.value, user_id: l?.user_id });
            }}>
              <option value="">— selecione —</option>
              {(licenses.data?.licenses ?? []).map((l) => <option key={l.id} value={l.id}>{l.customer_name} · {l.product_name} · {l.license_key}</option>)}
            </Select>
          </Field>
          <Field label="Valor (R$) *"><Input type="number" step="0.01" required value={form.amount ?? ""} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
          <Field label="Método"><Input value={form.method ?? ""} onChange={(e) => setForm({ ...form, method: e.target.value })} placeholder="pix, boleto, cartão…" /></Field>
          <Field label="Status"><Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="pending">Pendente</option><option value="paid">Pago</option><option value="failed">Falhou</option><option value="refunded">Estornado</option></Select></Field>
          <Field label="Vencimento"><Input type="date" value={form.due_date ?? ""} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></Field>
          <Field label="Referência"><Input value={form.reference ?? ""} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></Field>
          <div className="md:col-span-2"><Field label="Observações"><Textarea rows={2} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field></div>
          <div className="md:col-span-2 flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={create.isPending}>{create.isPending ? "Salvando…" : "Criar"}</Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}

/* =================== CONFIG PAGAMENTOS =================== */
function SettingsTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["payment-settings"], queryFn: () => api.get<any>("/api/payment-settings") });
  const save = useMutation({
    mutationFn: (b: any) => api.put("/api/payment-settings", b),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payment-settings"] }),
  });

  if (isLoading) return <Card>Carregando…</Card>;
  const s = data?.settings;
  const sec = data?.secretStatus ?? {};
  if (!s) return <Card>Nenhuma configuração criada ainda. Será criada no primeiro uso.</Card>;

  return (
    <Card>
      <h2 className="font-semibold mb-3">Configuração de pagamentos</h2>
      <form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); save.mutate({ id: s.id, active_provider: f.get("active_provider"), asaas_env: f.get("asaas_env"), notes: f.get("notes") }); }} className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl">
        <Field label="Provedor ativo">
          <Select name="active_provider" defaultValue={s.active_provider}>
            <option value="manual">Manual</option>
            <option value="asaas">Asaas</option>
            <option value="sicredi">Sicredi</option>
            <option value="sicoob">Sicoob</option>
          </Select>
        </Field>
        <Field label="Ambiente Asaas">
          <Select name="asaas_env" defaultValue={s.asaas_env}>
            <option value="sandbox">Sandbox</option>
            <option value="production">Produção</option>
          </Select>
        </Field>
        <div className="md:col-span-2"><Field label="Notas"><Textarea name="notes" rows={2} defaultValue={s.notes ?? ""} /></Field></div>
        <div className="md:col-span-2 text-xs text-slate-500">
          <p className="mb-1">Status das credenciais (definidas no <code>.env</code>):</p>
          <ul className="list-disc pl-5">
            <li>Asaas: {sec.asaas ? "✅ configurado" : "⚠️ ausente"}</li>
            <li>Sicredi: {sec.sicredi ? "✅ configurado" : "⚠️ ausente"}</li>
            <li>Sicoob: {sec.sicoob ? "✅ configurado" : "⚠️ ausente"}</li>
          </ul>
        </div>
        <div className="md:col-span-2"><Button type="submit" disabled={save.isPending}>{save.isPending ? "Salvando…" : "Salvar"}</Button></div>
      </form>
    </Card>
  );
}
