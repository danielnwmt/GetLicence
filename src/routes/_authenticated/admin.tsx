import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { createCustomer } from "@/lib/customers.functions";
import { issueAsaasBoleto } from "@/lib/boletos.functions";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Package, KeyRound, CreditCard, Users, DollarSign, Pencil, Trash2, CheckCircle2, Landmark, Copy, FileText, ExternalLink } from "lucide-react";
import { formatBRL, formatDate, statusLabel } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — LicençaHub" }] }),
  component: AdminPage,
});

interface Product { id: string; name: string; description: string | null; price_monthly: number; price_yearly: number; active: boolean; }
interface Profile { user_id: string; full_name: string | null; email: string | null; }
interface LicenseRow {
  id: string; license_key: string; plan: string; status: string;
  starts_at: string; expires_at: string; user_id: string; product_id: string;
  product: { name: string } | null; profile?: Profile | null;
}
interface PaymentRow {
  id: string; amount: number; status: string; method: string | null;
  paid_at: string | null; created_at: string; license_id: string; user_id: string;
  boleto_url: string | null; invoice_url: string | null; barcode: string | null;
  provider_charge_id: string | null;
  license: { license_key: string } | null;
}

function AdminPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && role && role !== "admin") {
      toast.error("Acesso restrito a administradores");
      navigate({ to: "/dashboard" });
    }
  }, [role, loading, navigate]);

  const [products, setProducts] = useState<Product[]>([]);
  const [licenses, setLicenses] = useState<LicenseRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const reload = useCallback(async () => {
    const [p, l, pay, pr] = await Promise.all([
      supabase.from("products").select("*").order("created_at", { ascending: false }),
      supabase.from("licenses").select("*, product:products(name)").order("created_at", { ascending: false }),
      supabase.from("payments").select("*, license:licenses(license_key)").order("created_at", { ascending: false }),
      supabase.from("profiles").select("user_id, full_name, email"),
    ]);
    setProducts((p.data as Product[]) || []);
    setLicenses((l.data as unknown as LicenseRow[]) || []);
    setPayments((pay.data as unknown as PaymentRow[]) || []);
    setProfiles((pr.data as Profile[]) || []);
  }, []);

  useEffect(() => { if (role === "admin") reload(); }, [role, reload]);

  if (loading || role !== "admin") {
    return <div className="text-muted-foreground">Verificando permissões...</div>;
  }

  const totalRevenue = payments.filter((p) => p.status === "paid").reduce((sum, p) => sum + Number(p.amount), 0);
  const activeCount = licenses.filter((l) => l.status === "active").length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Painel administrativo</h1>
        <p className="text-muted-foreground">Gerencie produtos, licenças, pagamentos e clientes.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={Users} label="Clientes" value={profiles.length.toString()} />
        <StatCard icon={KeyRound} label="Licenças ativas" value={activeCount.toString()} />
        <StatCard icon={Package} label="Produtos" value={products.length.toString()} />
        <StatCard icon={DollarSign} label="Receita paga" value={formatBRL(totalRevenue)} />
      </div>

      <Tabs defaultValue="licenses">
        <TabsList>
          <TabsTrigger value="licenses">Licenças</TabsTrigger>
          <TabsTrigger value="payments">Pagamentos</TabsTrigger>
          <TabsTrigger value="products">Produtos</TabsTrigger>
          <TabsTrigger value="customers">Clientes</TabsTrigger>
          <TabsTrigger value="integrations">Integrações</TabsTrigger>
        </TabsList>

        <TabsContent value="licenses" className="mt-6">
          <LicensesTab licenses={licenses} products={products} profiles={profiles} onChange={reload} />
        </TabsContent>
        <TabsContent value="payments" className="mt-6">
          <PaymentsTab payments={payments} onChange={reload} />
        </TabsContent>
        <TabsContent value="products" className="mt-6">
          <ProductsTab products={products} onChange={reload} />
        </TabsContent>
        <TabsContent value="customers" className="mt-6">
          <CustomersTab profiles={profiles} licenses={licenses} onChange={reload} />
        </TabsContent>
        <TabsContent value="integrations" className="mt-6">
          <IntegrationsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <Card className="bg-gradient-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="mt-1 text-2xl font-bold">{value}</div>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

const statusBadge: Record<string, string> = {
  active: "bg-success/15 text-success border-success/30",
  pending: "bg-warning/15 text-warning-foreground border-warning/30",
  expired: "bg-muted text-muted-foreground border-border",
  cancelled: "bg-destructive/15 text-destructive border-destructive/30",
  paid: "bg-success/15 text-success border-success/30",
  failed: "bg-destructive/15 text-destructive border-destructive/30",
  refunded: "bg-muted text-muted-foreground border-border",
};

// ---------- Products ----------
function ProductsTab({ products, onChange }: { products: Product[]; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({ name: "", description: "", price_monthly: "0", price_yearly: "0" });

  const openNew = () => { setEditing(null); setForm({ name: "", description: "", price_monthly: "0", price_yearly: "0" }); setOpen(true); };
  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({ name: p.name, description: p.description ?? "", price_monthly: String(p.price_monthly), price_yearly: String(p.price_yearly) });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Nome é obrigatório");
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price_monthly: Number(form.price_monthly) || 0,
      price_yearly: Number(form.price_yearly) || 0,
    };
    const { error } = editing
      ? await supabase.from("products").update(payload).eq("id", editing.id)
      : await supabase.from("products").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Produto atualizado" : "Produto criado");
    setOpen(false);
    onChange();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este produto?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Produto excluído");
    onChange();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Novo produto</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Editar produto" : "Novo produto"}</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-2"><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="space-y-2"><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Preço mensal (R$)</Label><Input type="number" step="0.01" value={form.price_monthly} onChange={(e) => setForm({ ...form, price_monthly: e.target.value })} /></div>
                <div className="space-y-2"><Label>Preço anual (R$)</Label><Input type="number" step="0.01" value={form.price_yearly} onChange={(e) => setForm({ ...form, price_yearly: e.target.value })} /></div>
              </div>
            </div>
            <DialogFooter><Button onClick={save}>Salvar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left"><tr>
            <th className="p-3 font-medium">Produto</th><th className="p-3 font-medium">Mensal</th>
            <th className="p-3 font-medium">Anual</th><th className="p-3 font-medium">Status</th><th className="p-3"></th>
          </tr></thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="p-3"><div className="font-medium">{p.name}</div><div className="text-xs text-muted-foreground">{p.description}</div></td>
                <td className="p-3">{formatBRL(Number(p.price_monthly))}</td>
                <td className="p-3">{formatBRL(Number(p.price_yearly))}</td>
                <td className="p-3"><Badge variant="outline">{p.active ? "Ativo" : "Inativo"}</Badge></td>
                <td className="p-3 text-right">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </td>
              </tr>
            ))}
            {products.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nenhum produto. Crie o primeiro.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ---------- Licenses ----------
function LicensesTab({ licenses, products, profiles, onChange }: {
  licenses: LicenseRow[]; products: Product[]; profiles: Profile[]; onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ user_id: "", product_id: "", plan: "monthly", status: "active", auto_pay: true });

  const profileById = (id: string) => profiles.find((p) => p.user_id === id);

  const create = async () => {
    if (!form.user_id || !form.product_id) return toast.error("Selecione cliente e produto");
    const months = form.plan === "yearly" ? 12 : 1;
    const expires = new Date();
    expires.setMonth(expires.getMonth() + months);
    const product = products.find((p) => p.id === form.product_id);
    const { data: lic, error } = await supabase.from("licenses").insert({
      user_id: form.user_id,
      product_id: form.product_id,
      plan: form.plan as "monthly" | "yearly",
      status: form.status as "active" | "pending" | "expired" | "cancelled",
      expires_at: expires.toISOString(),
    }).select().single();
    if (error) return toast.error(error.message);

    if (form.auto_pay && product) {
      const amount = form.plan === "yearly" ? Number(product.price_yearly) : Number(product.price_monthly);
      if (amount > 0) {
        await supabase.from("payments").insert({
          user_id: form.user_id,
          license_id: lic.id,
          amount,
          status: form.status === "active" ? "paid" : "pending",
          paid_at: form.status === "active" ? new Date().toISOString() : null,
        });
      }
    }
    toast.success("Licença emitida");
    setOpen(false);
    onChange();
  };

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("licenses").update({ status: status as "active" | "pending" | "expired" | "cancelled" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Status atualizado");
    onChange();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir licença?")) return;
    const { error } = await supabase.from("licenses").delete().eq("id", id);
    if (error) return toast.error(error.message);
    onChange();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Emitir licença</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova licença</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-2"><Label>Cliente</Label>
                <Select value={form.user_id} onValueChange={(v) => setForm({ ...form, user_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{profiles.map((p) => (
                    <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || p.email}</SelectItem>
                  ))}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Produto</Label>
                <Select value={form.product_id} onValueChange={(v) => setForm({ ...form, product_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Plano</Label>
                <Select value={form.plan} onValueChange={(v) => setForm({ ...form, plan: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Mensal (1 mês)</SelectItem>
                    <SelectItem value="yearly">Anual (12 meses)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Status inicial</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativa</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.auto_pay} onChange={(e) => setForm({ ...form, auto_pay: e.target.checked })} />
                Criar registro de pagamento automático
              </label>
            </div>
            <DialogFooter><Button onClick={create}>Emitir</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left"><tr>
            <th className="p-3 font-medium">Cliente</th><th className="p-3 font-medium">Produto</th>
            <th className="p-3 font-medium">Chave</th><th className="p-3 font-medium">Plano</th>
            <th className="p-3 font-medium">Expira</th><th className="p-3 font-medium">Status</th><th className="p-3"></th>
          </tr></thead>
          <tbody>
            {licenses.map((l) => {
              const prof = profileById(l.user_id);
              return (
                <tr key={l.id} className="border-t border-border">
                  <td className="p-3"><div className="font-medium">{prof?.full_name || "—"}</div><div className="text-xs text-muted-foreground">{prof?.email}</div></td>
                  <td className="p-3">{l.product?.name}</td>
                  <td className="p-3 font-mono text-xs">{l.license_key}</td>
                  <td className="p-3 capitalize">{l.plan === "monthly" ? "Mensal" : "Anual"}</td>
                  <td className="p-3">{formatDate(l.expires_at)}</td>
                  <td className="p-3">
                    <Select value={l.status} onValueChange={(v) => setStatus(l.id, v)}>
                      <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Ativa</SelectItem>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="expired">Expirada</SelectItem>
                        <SelectItem value="cancelled">Cancelada</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => remove(l.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </td>
                </tr>
              );
            })}
            {licenses.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhuma licença emitida.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ---------- Payments ----------
function PaymentsTab({ payments, onChange }: { payments: PaymentRow[]; onChange: () => void }) {
  const issueBoleto = useServerFn(issueAsaasBoleto);
  const [issuingId, setIssuingId] = useState<string | null>(null);

  const markPaid = async (id: string) => {
    const { error } = await supabase.from("payments").update({ status: "paid" as const, paid_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Pagamento confirmado");
    onChange();
  };
  const setStatus = async (id: string, status: string) => {
    const update: { status: "pending" | "paid" | "failed" | "refunded"; paid_at?: string | null } = {
      status: status as "pending" | "paid" | "failed" | "refunded",
    };
    if (status === "paid") update.paid_at = new Date().toISOString();
    if (status === "pending") update.paid_at = null;
    const { error } = await supabase.from("payments").update(update).eq("id", id);
    if (error) return toast.error(error.message);
    onChange();
  };

  const emitir = async (id: string) => {
    setIssuingId(id);
    try {
      const r = await issueBoleto({ data: { payment_id: id } });
      toast.success("Boleto emitido");
      if (r.boleto_url) window.open(r.boleto_url, "_blank");
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao emitir boleto");
    } finally {
      setIssuingId(null);
    }
  };

  return (
    <Card className="overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left"><tr>
          <th className="p-3 font-medium">Data</th><th className="p-3 font-medium">Licença</th>
          <th className="p-3 font-medium">Valor</th><th className="p-3 font-medium">Pago em</th>
          <th className="p-3 font-medium">Status</th><th className="p-3 font-medium">Boleto</th><th className="p-3"></th>
        </tr></thead>
        <tbody>
          {payments.map((p) => (
            <tr key={p.id} className="border-t border-border">
              <td className="p-3">{formatDate(p.created_at)}</td>
              <td className="p-3 font-mono text-xs">{p.license?.license_key ?? "—"}</td>
              <td className="p-3 font-medium">{formatBRL(Number(p.amount))}</td>
              <td className="p-3">{p.paid_at ? formatDate(p.paid_at) : "—"}</td>
              <td className="p-3">
                <Select value={p.status} onValueChange={(v) => setStatus(p.id, v)}>
                  <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="paid">Pago</SelectItem>
                    <SelectItem value="failed">Falhou</SelectItem>
                    <SelectItem value="refunded">Reembolsado</SelectItem>
                  </SelectContent>
                </Select>
              </td>
              <td className="p-3">
                {p.boleto_url ? (
                  <a href={p.boleto_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline text-xs">
                    <FileText className="h-3.5 w-3.5" /> Abrir
                  </a>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </td>
              <td className="p-3 text-right space-x-1">
                {!p.boleto_url && p.status !== "paid" && (
                  <Button size="sm" variant="outline" onClick={() => emitir(p.id)} disabled={issuingId === p.id}>
                    <FileText className="mr-1 h-3.5 w-3.5" /> {issuingId === p.id ? "Emitindo..." : "Emitir boleto"}
                  </Button>
                )}
                {p.status !== "paid" && (
                  <Button size="sm" variant="ghost" onClick={() => markPaid(p.id)}>
                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Pago
                  </Button>
                )}
              </td>
            </tr>
          ))}
          {payments.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhum pagamento.</td></tr>}
        </tbody>
      </table>
    </Card>
  );
}

// ---------- Customers ----------
function CustomersTab({ profiles, licenses, onChange }: { profiles: Profile[]; licenses: LicenseRow[]; onChange: () => void }) {
  const createCustomerFn = useServerFn(createCustomer);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: "", email: "", password: "",
    cpf_cnpj: "", phone: "",
    address_zip: "", address_street: "", address_number: "",
    address_complement: "", address_neighborhood: "", address_city: "", address_state: "",
  });

  const save = async () => {
    if (!form.full_name.trim() || !form.email.trim() || form.password.length < 6) {
      return toast.error("Preencha nome, e-mail e senha (mín. 6 caracteres)");
    }
    if (form.cpf_cnpj.replace(/\D/g, "").length < 11) {
      return toast.error("Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido");
    }
    setSaving(true);
    try {
      await createCustomerFn({ data: form });
      toast.success("Cliente cadastrado");
      setOpen(false);
      setForm({
        full_name: "", email: "", password: "",
        cpf_cnpj: "", phone: "",
        address_zip: "", address_street: "", address_number: "",
        address_complement: "", address_neighborhood: "", address_city: "", address_state: "",
      });
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao cadastrar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Novo cliente</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Cadastrar cliente</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2 max-h-[70vh] overflow-y-auto pr-1">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2"><Label>Nome completo / Razão social *</Label>
                  <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
                </div>
                <div className="space-y-2"><Label>CPF / CNPJ *</Label>
                  <Input value={form.cpf_cnpj} onChange={(e) => setForm({ ...form, cpf_cnpj: e.target.value })} placeholder="Somente números" />
                </div>
                <div className="space-y-2"><Label>E-mail *</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="space-y-2"><Label>Telefone</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(11) 99999-0000" />
                </div>
                <div className="space-y-2 md:col-span-2"><Label>Senha inicial *</Label>
                  <Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="mín. 6 caracteres" />
                </div>
              </div>

              <div className="pt-2 text-xs uppercase tracking-wide text-muted-foreground">Endereço</div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-2"><Label>CEP</Label>
                  <Input value={form.address_zip} onChange={(e) => setForm({ ...form, address_zip: e.target.value })} />
                </div>
                <div className="space-y-2 md:col-span-2"><Label>Rua / Logradouro</Label>
                  <Input value={form.address_street} onChange={(e) => setForm({ ...form, address_street: e.target.value })} />
                </div>
                <div className="space-y-2"><Label>Número</Label>
                  <Input value={form.address_number} onChange={(e) => setForm({ ...form, address_number: e.target.value })} />
                </div>
                <div className="space-y-2"><Label>Complemento</Label>
                  <Input value={form.address_complement} onChange={(e) => setForm({ ...form, address_complement: e.target.value })} />
                </div>
                <div className="space-y-2"><Label>Bairro</Label>
                  <Input value={form.address_neighborhood} onChange={(e) => setForm({ ...form, address_neighborhood: e.target.value })} />
                </div>
                <div className="space-y-2 md:col-span-2"><Label>Cidade</Label>
                  <Input value={form.address_city} onChange={(e) => setForm({ ...form, address_city: e.target.value })} />
                </div>
                <div className="space-y-2"><Label>UF</Label>
                  <Input maxLength={2} value={form.address_state} onChange={(e) => setForm({ ...form, address_state: e.target.value.toUpperCase() })} />
                </div>
              </div>
            </div>
            <DialogFooter><Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Cadastrar"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left"><tr>
            <th className="p-3 font-medium">Nome</th><th className="p-3 font-medium">E-mail</th><th className="p-3 font-medium">Licenças</th>
          </tr></thead>
          <tbody>
            {profiles.map((p) => {
              const count = licenses.filter((l) => l.user_id === p.user_id).length;
              return (
                <tr key={p.user_id} className="border-t border-border">
                  <td className="p-3 font-medium">{p.full_name || "—"}</td>
                  <td className="p-3">{p.email}</td>
                  <td className="p-3">{count}</td>
                </tr>
              );
            })}
            {profiles.length === 0 && <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">Nenhum cliente.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ---------- Integrations (bancos / pagamentos) ----------
type Provider = "asaas" | "sicredi" | "sicoob" | "manual";
interface SettingsRow {
  id: string;
  active_provider: Provider;
  asaas_env: string;
  webhook_token: string;
  notes: string | null;
  asaas_api_key: string | null;
  sicredi_client_id: string | null;
  sicredi_client_secret: string | null;
  sicredi_cert_pem: string | null;
  sicredi_cert_key: string | null;
  sicoob_client_id: string | null;
  sicoob_access_token: string | null;
  sicoob_cert_pem: string | null;
  sicoob_cert_key: string | null;
}

const SETTINGS_COLS =
  "id, active_provider, asaas_env, webhook_token, notes, asaas_api_key, sicredi_client_id, sicredi_client_secret, sicredi_cert_pem, sicredi_cert_key, sicoob_client_id, sicoob_access_token, sicoob_cert_pem, sicoob_cert_key";

function IntegrationsTab() {
  const [settings, setSettings] = useState<SettingsRow | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("payment_settings")
      .select(SETTINGS_COLS)
      .limit(1)
      .maybeSingle();
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data) {
      const { data: created, error: insErr } = await supabase
        .from("payment_settings")
        .insert({})
        .select(SETTINGS_COLS)
        .single();
      if (insErr) { toast.error(insErr.message); return; }
      setSettings(created as unknown as SettingsRow);
    } else {
      setSettings(data as unknown as SettingsRow);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = <K extends keyof SettingsRow>(key: K, value: SettingsRow[K]) => {
    setSettings((s) => (s ? { ...s, [key]: value } : s));
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    const { error } = await supabase
      .from("payment_settings")
      .update({
        active_provider: settings.active_provider,
        asaas_env: settings.asaas_env,
        notes: settings.notes,
        asaas_api_key: settings.asaas_api_key,
        sicredi_client_id: settings.sicredi_client_id,
        sicredi_client_secret: settings.sicredi_client_secret,
        sicredi_cert_pem: settings.sicredi_cert_pem,
        sicredi_cert_key: settings.sicredi_cert_key,
        sicoob_client_id: settings.sicoob_client_id,
        sicoob_access_token: settings.sicoob_access_token,
        sicoob_cert_pem: settings.sicoob_cert_pem,
        sicoob_cert_key: settings.sicoob_cert_key,
      })
      .eq("id", settings.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Configurações salvas");
    load();
  };

  if (!settings) return <div className="text-muted-foreground">Carregando...</div>;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const webhookUrl = `${origin}/api/public/webhooks/${settings.active_provider}?token=${settings.webhook_token}`;

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado");
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Landmark className="h-5 w-5 text-primary" />
          <div>
            <h3 className="text-lg font-semibold">Provedor de pagamento ativo</h3>
            <p className="text-sm text-muted-foreground">Escolha qual banco/gateway será usado para emitir cobranças.</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Provedor</Label>
            <Select value={settings.active_provider} onValueChange={(v) => setSettings({ ...settings, active_provider: v as Provider })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual (sem integração)</SelectItem>
                <SelectItem value="asaas">Asaas</SelectItem>
                <SelectItem value="sicredi">Sicredi</SelectItem>
                <SelectItem value="sicoob">Sicoob</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {settings.active_provider === "asaas" && (
            <div className="space-y-2">
              <Label>Ambiente Asaas</Label>
              <Select value={settings.asaas_env} onValueChange={(v) => setSettings({ ...settings, asaas_env: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">Sandbox (testes)</SelectItem>
                  <SelectItem value="production">Produção</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>Observações internas</Label>
          <Textarea value={settings.notes ?? ""} onChange={(e) => setSettings({ ...settings, notes: e.target.value })} placeholder="Anotações sobre a conta bancária, contato do gerente, etc." />
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar configurações"}</Button>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Credenciais do banco</h3>
          <p className="text-sm text-muted-foreground">
            Cole abaixo as chaves de API / tokens do provedor selecionado. Apenas administradores enxergam estes dados.
          </p>
        </div>

        {settings.active_provider === "asaas" && (
          <div className="rounded-lg border border-border p-4 space-y-3">
            <div className="font-semibold">Asaas</div>
            <div className="space-y-2">
              <Label>API Key</Label>
              <Input
                type="password"
                value={settings.asaas_api_key ?? ""}
                onChange={(e) => update("asaas_api_key", e.target.value)}
                placeholder="$aact_..."
              />
              <p className="text-xs text-muted-foreground">Gerada em Asaas → Integrações → API Asaas.</p>
            </div>
          </div>
        )}

        {settings.active_provider === "sicredi" && (
          <div className="rounded-lg border border-border p-4 space-y-3">
            <div className="font-semibold">Sicredi</div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Client ID</Label>
                <Input value={settings.sicredi_client_id ?? ""} onChange={(e) => update("sicredi_client_id", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Client Secret</Label>
                <Input type="password" value={settings.sicredi_client_secret ?? ""} onChange={(e) => update("sicredi_client_secret", e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Certificado mTLS (.pem)</Label>
              <Textarea rows={4} className="font-mono text-xs" value={settings.sicredi_cert_pem ?? ""} onChange={(e) => update("sicredi_cert_pem", e.target.value)} placeholder="-----BEGIN CERTIFICATE-----" />
            </div>
            <div className="space-y-2">
              <Label>Chave privada (.key)</Label>
              <Textarea rows={4} className="font-mono text-xs" value={settings.sicredi_cert_key ?? ""} onChange={(e) => update("sicredi_cert_key", e.target.value)} placeholder="-----BEGIN PRIVATE KEY-----" />
            </div>
          </div>
        )}

        {settings.active_provider === "sicoob" && (
          <div className="rounded-lg border border-border p-4 space-y-3">
            <div className="font-semibold">Sicoob</div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Client ID</Label>
                <Input value={settings.sicoob_client_id ?? ""} onChange={(e) => update("sicoob_client_id", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Access Token</Label>
                <Input type="password" value={settings.sicoob_access_token ?? ""} onChange={(e) => update("sicoob_access_token", e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Certificado mTLS (.pem)</Label>
              <Textarea rows={4} className="font-mono text-xs" value={settings.sicoob_cert_pem ?? ""} onChange={(e) => update("sicoob_cert_pem", e.target.value)} placeholder="-----BEGIN CERTIFICATE-----" />
            </div>
            <div className="space-y-2">
              <Label>Chave privada (.key)</Label>
              <Textarea rows={4} className="font-mono text-xs" value={settings.sicoob_cert_key ?? ""} onChange={(e) => update("sicoob_cert_key", e.target.value)} placeholder="-----BEGIN PRIVATE KEY-----" />
            </div>
          </div>
        )}

        {settings.active_provider === "manual" && (
          <p className="text-sm text-muted-foreground">Modo manual selecionado — nenhuma credencial necessária.</p>
        )}

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar credenciais"}</Button>
        </div>
      </Card>

      <Card className="p-6 space-y-3">
        <div>
          <h3 className="text-lg font-semibold">URL do Webhook</h3>
          <p className="text-sm text-muted-foreground">Configure esta URL no painel do provedor para receber confirmações de pagamento.</p>
        </div>
        <div className="flex items-center gap-2">
          <Input readOnly value={webhookUrl} className="font-mono text-xs" />
          <Button variant="outline" size="icon" onClick={() => copy(webhookUrl)}><Copy className="h-4 w-4" /></Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Token de validação: <code className="font-mono">{settings.webhook_token}</code>
        </p>
      </Card>
    </div>
  );
}

