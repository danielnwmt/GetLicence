import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { createCustomer, listAdminProfiles, updateCustomer } from "@/lib/customers.functions";
import { createSystemUser, updateSystemUser, deleteSystemUser } from "@/lib/system-users.functions";
import { issueAsaasBoleto, cancelAsaasBoleto } from "@/lib/boletos.functions";
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
import { Plus, Package, KeyRound, CreditCard, Users, DollarSign, Pencil, Trash2, Landmark, Copy, FileText, ExternalLink, XCircle } from "lucide-react";
import { formatBRL, formatDate, statusLabel } from "@/lib/format";
import { fetchCep } from "@/lib/cep";
import { formatCpfCnpj, isValidCpfCnpj } from "@/lib/mask";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area, Cell, PieChart, Pie, Legend } from "recharts";
import { QRCodeSVG } from "qrcode.react";

type AdminTab = "dashboard" | "licenses" | "customers" | "payments" | "products" | "settings";
const ADMIN_TABS: AdminTab[] = ["dashboard", "licenses", "customers", "payments", "products", "settings"];

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — GetLicence" }] }),
  validateSearch: (s: Record<string, unknown>): { tab?: AdminTab } => {
    const t = s.tab;
    return { tab: typeof t === "string" && (ADMIN_TABS as string[]).includes(t) ? (t as AdminTab) : undefined };
  },
  component: AdminPage,
});

interface Product { id: string; name: string; description: string | null; price_monthly: number; price_semestral: number; price_yearly: number; active: boolean; cost_vps?: number; cost_storage?: number; cost_other?: number; profit_margin?: number; vps_specs?: string | null; storage_amount?: number; storage_unit?: string; vps_storage_amount?: number; vps_storage_unit?: string; }
interface Profile { user_id: string; full_name: string | null; email: string | null; address_city?: string | null; address_state?: string | null; customer_number?: number | null; cpf_cnpj?: string | null; phone?: string | null; address_zip?: string | null; address_street?: string | null; address_number?: string | null; address_complement?: string | null; address_neighborhood?: string | null; }
interface LicenseRow {
  id: string; license_key: string; plan: string; status: string;
  starts_at: string; expires_at: string; user_id: string; product_id: string;
  device_ip?: string | null; last_seen_at?: string | null; activated_at?: string | null;
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
  const listAdminProfilesFn = useServerFn(listAdminProfiles);
  const navigate = useNavigate();
  const search = Route.useSearch();
  const currentTab: AdminTab = search.tab ?? "dashboard";
  const setTab = (t: string) => navigate({ to: "/admin", search: { tab: t as AdminTab }, replace: true });

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
  const [adminIds, setAdminIds] = useState<string[]>([]);

  const reload = useCallback(async () => {
    try {
      const [p, l, pay, pr, ur] = await Promise.all([
        supabase.from("products").select("*").order("created_at", { ascending: false }),
        supabase.from("licenses").select("*, product:products(name)").order("created_at", { ascending: false }),
        supabase.from("payments").select("*, license:licenses(license_key)").order("created_at", { ascending: false }),
        listAdminProfilesFn().catch((e) => {
          console.error("listAdminProfiles failed:", e);
          return [] as Profile[];
        }),
        supabase.from("user_roles").select("user_id, role").eq("role", "admin"),
      ]);
      setProducts((p.data as Product[]) || []);
      setLicenses((l.data as unknown as LicenseRow[]) || []);
      setPayments((pay.data as unknown as PaymentRow[]) || []);
      setProfiles(Array.isArray(pr) ? (pr as Profile[]) : []);
      setAdminIds(((ur.data as { user_id: string }[]) || []).map((r) => r.user_id));
    } catch (e) {
      console.error("Admin reload failed:", e);
    }
  }, [listAdminProfilesFn]);

  useEffect(() => { if (role === "admin") reload(); }, [role, reload]);

  if (loading || role !== "admin") {
    return <div className="text-muted-foreground">Verificando permissões...</div>;
  }

  const totalRevenue = payments.filter((p) => p.status === "paid").reduce((sum, p) => sum + Number(p.amount), 0);
  const activeCount = licenses.filter((l) => l.status === "active").length;

  return (
    <Tabs value={currentTab} onValueChange={setTab} className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Painel administrativo</h1>
        <p className="text-muted-foreground">Gerencie produtos, licenças, pagamentos e clientes.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={Users} label="Clientes" value={profiles.filter((p) => !adminIds.includes(p.user_id)).length.toString()} />
        <StatCard icon={KeyRound} label="Licenças ativas" value={activeCount.toString()} />
        <StatCard icon={Package} label="Produtos" value={products.length.toString()} />
        <StatCard icon={DollarSign} label="Receita paga" value={formatBRL(totalRevenue)} />
      </div>

        <TabsContent value="dashboard" className="mt-6">
          <DashboardCharts licenses={licenses} payments={payments} profiles={profiles.filter((p) => !adminIds.includes(p.user_id))} products={products} />
        </TabsContent>
        <TabsContent value="licenses" className="mt-6">
          <LicensesTab licenses={licenses} products={products} profiles={profiles.filter((p) => !adminIds.includes(p.user_id))} onChange={reload} />
        </TabsContent>
        <TabsContent value="payments" className="mt-6">
          <PaymentsTab payments={payments} licenses={licenses} products={products} profiles={profiles.filter((p) => !adminIds.includes(p.user_id))} onChange={reload} />
        </TabsContent>
        <TabsContent value="products" className="mt-6">
          <ProductsTab products={products} onChange={reload} />
        </TabsContent>
        <TabsContent value="customers" className="mt-6">
          <CustomersTab profiles={profiles.filter((p) => !adminIds.includes(p.user_id))} licenses={licenses} payments={payments} onChange={reload} />
        </TabsContent>
        <TabsContent value="settings" className="mt-6">
          <Tabs defaultValue="users" className="space-y-4">
            <TabsList>
             <TabsTrigger value="users">Usuários</TabsTrigger>
              <TabsTrigger value="integrations">Integrações</TabsTrigger>
              <TabsTrigger value="mobile">App Mobile</TabsTrigger>
            </TabsList>
            <TabsContent value="users">
              <SystemUsersTab profiles={profiles.filter((p) => adminIds.includes(p.user_id))} onChange={reload} />
            </TabsContent>
            <TabsContent value="integrations">
              <IntegrationsTab />
            </TabsContent>
            <TabsContent value="mobile">
              <MobileAppTab />
            </TabsContent>
          </Tabs>
        </TabsContent>
    </Tabs>
  );
}

function DashboardCharts({ licenses, payments, profiles, products }: { licenses: LicenseRow[]; payments: PaymentRow[]; profiles: Profile[]; products: Product[] }) {
  // Top products by license count
  const productCounts = new Map<string, number>();
  for (const l of licenses) {
    const name = l.product?.name ?? "—";
    productCounts.set(name, (productCounts.get(name) ?? 0) + 1);
  }
  const topProducts = Array.from(productCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Revenue by month (last 6 months) from paid payments
  const months: { key: string; label: string; total: number }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("pt-BR", { month: "short" });
    months.push({ key, label, total: 0 });
  }
  const monthIndex = new Map(months.map((m, i) => [m.key, i]));
  for (const p of payments) {
    if (p.status !== "paid") continue;
    const dateStr = p.paid_at ?? p.created_at;
    const d = new Date(dateStr);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const idx = monthIndex.get(key);
    if (idx !== undefined) months[idx].total += Number(p.amount);
  }

  const totalClients = profiles.length;
  const totalLicenses = licenses.length;
  const totalRevenue = payments.filter((p) => p.status === "paid").reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5"><div className="text-xs uppercase text-muted-foreground">Total de clientes</div><div className="mt-1 text-2xl font-bold">{totalClients}</div></Card>
        <Card className="p-5"><div className="text-xs uppercase text-muted-foreground">Total de licenças</div><div className="mt-1 text-2xl font-bold">{totalLicenses}</div></Card>
        <Card className="p-5"><div className="text-xs uppercase text-muted-foreground">Faturamento total</div><div className="mt-1 text-2xl font-bold">{formatBRL(totalRevenue)}</div></Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5 bg-gradient-card border-border/60 shadow-elegant">
          <div className="mb-1 flex items-center justify-between">
            <div>
              <div className="font-semibold">Licenças mais vendidas</div>
              <div className="text-xs text-muted-foreground">Top produtos por nº de licenças</div>
            </div>
            <Badge variant="secondary" className="font-normal">{topProducts.length} produtos</Badge>
          </div>
          {topProducts.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Sem licenças emitidas.</div>
          ) : (() => {
            const PIE_COLORS = [
              "oklch(0.6 0.18 255)",
              "oklch(0.7 0.16 200)",
              "oklch(0.65 0.18 300)",
              "oklch(0.72 0.17 160)",
              "oklch(0.68 0.18 30)",
              "oklch(0.62 0.2 350)",
              "oklch(0.74 0.16 90)",
              "oklch(0.55 0.18 230)",
            ];
            const total = topProducts.reduce((s, p) => s + p.count, 0);
            return (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid oklch(0.9 0.01 255)", boxShadow: "0 8px 24px -8px oklch(0.55 0.18 255 / 0.25)", padding: "8px 12px" }}
                    labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                    formatter={(v, n) => [`${Number(v)} (${((Number(v) / total) * 100).toFixed(1)}%)`, n as string]}
                  />
                  <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Pie
                    data={topProducts}
                    dataKey="count"
                    nameKey="name"
                    cx="40%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={110}
                    paddingAngle={2}
                    stroke="oklch(1 0 0)"
                    strokeWidth={2}
                  >
                    {topProducts.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            );
          })()}
        </Card>
        <Card className="p-5 bg-gradient-card border-border/60 shadow-elegant">
          <div className="mb-1 flex items-center justify-between">
            <div>
              <div className="font-semibold">Faturamento</div>
              <div className="text-xs text-muted-foreground">Últimos 6 meses (pagos)</div>
            </div>
            <Badge variant="secondary" className="font-normal">{formatBRL(months.reduce((s, m) => s + m.total, 0))}</Badge>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={months} margin={{ top: 16, right: 8, left: -8, bottom: 4 }}>
              <defs>
                <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.7 0.18 255)" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="oklch(0.7 0.18 255)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="oklch(0.92 0.01 255)" strokeDasharray="4 4" />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: "oklch(0.45 0.02 260)" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "oklch(0.45 0.02 260)" }} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => v >= 1000 ? `R$${(v / 1000).toFixed(1)}k` : `R$${v}`} />
              <Tooltip
                cursor={{ stroke: "oklch(0.55 0.18 255)", strokeWidth: 1, strokeDasharray: "4 4" }}
                contentStyle={{ borderRadius: 12, border: "1px solid oklch(0.9 0.01 255)", boxShadow: "0 8px 24px -8px oklch(0.55 0.18 255 / 0.25)", padding: "8px 12px" }}
                labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                formatter={(v) => [formatBRL(Number(v)), "Faturamento"]}
              />
              <Area type="monotone" dataKey="total" stroke="oklch(0.55 0.18 255)" strokeWidth={2.5} fill="url(#areaFill)" activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>
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
  const emptyForm = { name: "", description: "", vps_specs: "", vps_storage_amount: "0", vps_storage_unit: "GB", storage_amount: "0", storage_unit: "GB", cost_vps: "0", cost_storage: "0", cost_other: "0", profit_margin: "30", price_monthly: "0", price_semestral: "0", price_yearly: "0" };
  const [form, setForm] = useState(emptyForm);

  const totalCost = (Number(form.cost_vps) || 0) + (Number(form.cost_storage) || 0) + (Number(form.cost_other) || 0);
  const margin = Number(form.profit_margin) || 0;
  const computedMonthly = +(totalCost * (1 + margin / 100)).toFixed(2);
  const computedSemestral = +(computedMonthly * 6 * 0.95).toFixed(2);
  const computedYearly = +(computedMonthly * 12 * 0.9).toFixed(2);

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description ?? "",
      vps_specs: p.vps_specs ?? "",
      vps_storage_amount: String(p.vps_storage_amount ?? 0),
      vps_storage_unit: p.vps_storage_unit ?? "GB",
      storage_amount: String(p.storage_amount ?? 0),
      storage_unit: p.storage_unit ?? "GB",
      cost_vps: String(p.cost_vps ?? 0),
      cost_storage: String(p.cost_storage ?? 0),
      cost_other: String(p.cost_other ?? 0),
      profit_margin: String(p.profit_margin ?? 30),
      price_monthly: String(p.price_monthly),
      price_semestral: String(p.price_semestral ?? 0),
      price_yearly: String(p.price_yearly),
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Nome é obrigatório");
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      vps_specs: form.vps_specs.trim(),
      vps_storage_amount: Number(form.vps_storage_amount) || 0,
      vps_storage_unit: form.vps_storage_unit,
      storage_amount: Number(form.storage_amount) || 0,
      storage_unit: form.storage_unit,
      cost_vps: Number(form.cost_vps) || 0,
      cost_storage: Number(form.cost_storage) || 0,
      cost_other: Number(form.cost_other) || 0,
      profit_margin: margin,
      price_monthly: computedMonthly,
      price_semestral: computedSemestral,
      price_yearly: computedYearly,
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
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? "Editar produto" : "Novo produto"}</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-2"><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="space-y-2"><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="rounded-md border p-3 space-y-3">
                <div className="text-sm font-medium">Recursos & Custos mensais</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Recursos da VPS</Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                      value={form.vps_specs}
                      onChange={(e) => setForm({ ...form, vps_specs: e.target.value })}
                    >
                      <option value="">Selecione...</option>
                      <option value="1 vCPU, 1GB RAM">1 vCPU, 1GB RAM</option>
                      <option value="1 vCPU, 2GB RAM">1 vCPU, 2GB RAM</option>
                      <option value="2 vCPU, 2GB RAM">2 vCPU, 2GB RAM</option>
                      <option value="2 vCPU, 4GB RAM">2 vCPU, 4GB RAM</option>
                      <option value="4 vCPU, 4GB RAM">4 vCPU, 4GB RAM</option>
                      <option value="4 vCPU, 8GB RAM">4 vCPU, 8GB RAM</option>
                      <option value="6 vCPU, 12GB RAM">6 vCPU, 12GB RAM</option>
                      <option value="8 vCPU, 16GB RAM">8 vCPU, 16GB RAM</option>
                      <option value="8 vCPU, 32GB RAM">8 vCPU, 32GB RAM</option>
                      <option value="16 vCPU, 32GB RAM">16 vCPU, 32GB RAM</option>
                      <option value="16 vCPU, 64GB RAM">16 vCPU, 64GB RAM</option>
                    </select>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Armaz. da VPS"
                        value={form.vps_storage_amount}
                        onChange={(e) => setForm({ ...form, vps_storage_amount: e.target.value })}
                      />
                      <select
                        className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                        value={form.vps_storage_unit}
                        onChange={(e) => setForm({ ...form, vps_storage_unit: e.target.value })}
                      >
                        <option value="GB">GB</option>
                        <option value="TB">TB</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Armazenamento extra</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Qtd"
                        value={form.storage_amount}
                        onChange={(e) => setForm({ ...form, storage_amount: e.target.value })}
                      />
                      <select
                        className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                        value={form.storage_unit}
                        onChange={(e) => setForm({ ...form, storage_unit: e.target.value })}
                      >
                        <option value="GB">GB</option>
                        <option value="TB">TB</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2"><Label>Custo VPS (R$)</Label><Input type="number" step="0.01" value={form.cost_vps} onChange={(e) => setForm({ ...form, cost_vps: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Custo Armaz. (R$)</Label><Input type="number" step="0.01" value={form.cost_storage} onChange={(e) => setForm({ ...form, cost_storage: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Outros (R$)</Label><Input type="number" step="0.01" value={form.cost_other} onChange={(e) => setForm({ ...form, cost_other: e.target.value })} /></div>
                </div>
                <div className="text-xs text-muted-foreground">Custo total: {formatBRL(totalCost)}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Margem de lucro (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={form.profit_margin}
                    onChange={(e) => setForm({ ...form, profit_margin: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Preço de venda (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.price_monthly}
                    onChange={(e) => {
                      const price = Number(e.target.value) || 0;
                      const newMargin = totalCost > 0 ? +(((price / totalCost) - 1) * 100).toFixed(2) : 0;
                      setForm({ ...form, price_monthly: e.target.value, profit_margin: String(newMargin) });
                    }}
                  />
                </div>
              </div>
              <div className="rounded-md bg-muted/50 p-3 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Preço mensal calculado</span><span className="font-semibold">{formatBRL(computedMonthly)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Preço semestral (5% desc.)</span><span className="font-semibold">{formatBRL(computedSemestral)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Preço anual (10% desc.)</span><span className="font-semibold">{formatBRL(computedYearly)}</span></div>
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
            <th className="p-3 font-medium">Semestral</th>
            <th className="p-3 font-medium">Anual</th><th className="p-3 font-medium">Status</th><th className="p-3"></th>
          </tr></thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="p-3"><div className="font-medium">{p.name}</div><div className="text-xs text-muted-foreground">{p.description}</div></td>
                <td className="p-3">{formatBRL(Number(p.price_monthly))}</td>
                <td className="p-3">{formatBRL(Number(p.price_semestral))}</td>
                <td className="p-3">{formatBRL(Number(p.price_yearly))}</td>
                <td className="p-3"><Badge variant="outline">{p.active ? "Ativo" : "Inativo"}</Badge></td>
                <td className="p-3 text-right">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </td>
              </tr>
            ))}
            {products.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nenhum produto. Crie o primeiro.</td></tr>}
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
  const [form, setForm] = useState({ user_id: "", product_id: "", plan: "monthly", status: "pending", auto_pay: true });

  const profileById = (id: string) => profiles.find((p) => p.user_id === id);

  const create = async () => {
    if (!form.user_id || !form.product_id) return toast.error("Selecione cliente e produto");
    const months = form.plan === "yearly" ? 12 : form.plan === "semestral" ? 6 : 1;
    const expires = new Date();
    expires.setMonth(expires.getMonth() + months);
    const product = products.find((p) => p.id === form.product_id);
    const { data: lic, error } = await supabase.from("licenses").insert({
      user_id: form.user_id,
      product_id: form.product_id,
      plan: form.plan as "monthly" | "semestral" | "yearly",
      status: form.status as "active" | "pending" | "expired" | "cancelled" | "blocked",
      expires_at: expires.toISOString(),
    }).select().single();
    if (error) return toast.error(error.message);

    if (form.auto_pay && product) {
      const amount = form.plan === "yearly" ? Number(product.price_yearly) : form.plan === "semestral" ? Number(product.price_semestral) : Number(product.price_monthly);
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
    const { error } = await supabase.from("licenses").update({ status: status as "active" | "pending" | "expired" | "cancelled" | "blocked" }).eq("id", id);
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
                    <SelectItem value="semestral">Semestral (6 meses)</SelectItem>
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
            
            <th className="p-3 font-medium">IP</th>
            <th className="p-3 font-medium">Último contato</th>
            <th className="p-3 font-medium">Status</th><th className="p-3"></th>
          </tr></thead>
          <tbody>
            {licenses.map((l) => {
              const prof = profileById(l.user_id);
              return (
                <tr key={l.id} className="border-t border-border">
                  <td className="p-3"><div className="font-medium">{prof?.full_name || "—"}</div><div className="text-xs text-muted-foreground">{prof?.email}</div></td>
                  <td className="p-3">{l.product?.name}</td>
                  <td className="p-3 font-mono text-xs">{l.license_key}</td>
                  <td className="p-3 capitalize">{l.plan === "monthly" ? "Mensal" : l.plan === "semestral" ? "Semestral" : "Anual"}</td>
                  
                  <td className="p-3 font-mono text-xs">{l.device_ip || "—"}</td>
                  <td className="p-3 text-xs">{l.last_seen_at ? new Date(l.last_seen_at).toLocaleString("pt-BR") : "—"}</td>
                  <td className="p-3">
                    <Select value={l.status} onValueChange={(v) => setStatus(l.id, v)}>
                      <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Ativa</SelectItem>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="blocked">Bloqueada</SelectItem>
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
            {licenses.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">Nenhuma licença emitida.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ---------- Payments ----------
function PaymentsTab({ payments, licenses, profiles, onChange }: { payments: PaymentRow[]; licenses: LicenseRow[]; profiles: Profile[]; onChange: () => void }) {
  const issueBoleto = useServerFn(issueAsaasBoleto);
  const cancelBoleto = useServerFn(cancelAsaasBoleto);
  const [issuingId, setIssuingId] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newForm, setNewForm] = useState({ user_id: "", license_id: "", amount: "", due_date: "" });
  const [search, setSearch] = useState("");
  const profileById = new Map(profiles.map((p) => [p.user_id, p]));
  const q = search.trim().toLowerCase();
  const filteredPayments = !q ? payments : payments.filter((p) => {
    const prof = profileById.get(p.user_id);
    return (
      (prof?.full_name || "").toLowerCase().includes(q) ||
      (prof?.email || "").toLowerCase().includes(q) ||
      (prof?.cpf_cnpj || "").toLowerCase().includes(q) ||
      (p.license?.license_key || "").toLowerCase().includes(q)
    );
  });

  const clientLicenses = licenses.filter((l) => l.user_id === newForm.user_id);

  const createBoleto = async () => {
    if (!newForm.user_id || !newForm.license_id) return toast.error("Selecione cliente e licença");
    const amount = Number(newForm.amount);
    if (!amount || amount <= 0) return toast.error("Informe um valor válido");
    setCreating(true);
    try {
      const { data: pay, error } = await supabase.from("payments").insert({
        user_id: newForm.user_id,
        license_id: newForm.license_id,
        amount,
        status: "pending" as const,
        due_date: newForm.due_date || null,
      }).select().single();
      if (error) throw new Error(error.message);
      const r = await issueBoleto({ data: { payment_id: pay.id } });
      toast.success("Boleto emitido");
      if (r.boleto_url) window.open(r.boleto_url, "_blank");
      setNewOpen(false);
      setNewForm({ user_id: "", license_id: "", amount: "", due_date: "" });
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao emitir boleto");
    } finally {
      setCreating(false);
    }
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

  const cancelar = async (id: string) => {
    if (!confirm("Cancelar este boleto no Asaas? Esta ação não pode ser desfeita.")) return;
    setCancelingId(id);
    try {
      await cancelBoleto({ data: { payment_id: id } });
      toast.success("Boleto cancelado");
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao cancelar boleto");
    } finally {
      setCancelingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={newOpen} onOpenChange={setNewOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Novo boleto</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Emitir novo boleto</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-2"><Label>Cliente</Label>
                <Select value={newForm.user_id} onValueChange={(v) => setNewForm({ ...newForm, user_id: v, license_id: "" })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{profiles.map((p) => (
                    <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || p.email}</SelectItem>
                  ))}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Licença</Label>
                <Select value={newForm.license_id} onValueChange={(v) => setNewForm({ ...newForm, license_id: v })} disabled={!newForm.user_id}>
                  <SelectTrigger><SelectValue placeholder={newForm.user_id ? "Selecione..." : "Escolha o cliente primeiro"} /></SelectTrigger>
                  <SelectContent>{clientLicenses.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.product?.name ?? "Licença"} — {l.license_key}</SelectItem>
                  ))}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Valor (R$)</Label>
                  <Input type="number" step="0.01" value={newForm.amount} onChange={(e) => setNewForm({ ...newForm, amount: e.target.value })} />
                </div>
                <div className="space-y-2"><Label>Vencimento</Label>
                  <Input type="date" value={newForm.due_date} onChange={(e) => setNewForm({ ...newForm, due_date: e.target.value })} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={createBoleto} disabled={creating}>{creating ? "Emitindo..." : "Emitir boleto"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="flex items-center gap-2">
        <Input
          placeholder="Buscar cliente por nome, e-mail, CPF/CNPJ ou licença..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
      </div>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left"><tr>
          <th className="p-3 font-medium">Data</th>
          <th className="p-3 font-medium">Cliente</th>
          <th className="p-3 font-medium">Licença</th>
          <th className="p-3 font-medium">Valor</th><th className="p-3 font-medium">Pago em</th>
          <th className="p-3 font-medium">Status</th><th className="p-3 font-medium">Boleto</th><th className="p-3"></th>
        </tr></thead>
        <tbody>
          {filteredPayments.map((p) => {
            const prof = profileById.get(p.user_id);
            const statusVariant = p.status === "paid" ? "default" : p.status === "failed" ? "destructive" : "secondary";
            return (
            <tr key={p.id} className="border-t border-border">
              <td className="p-3">{formatDate(p.created_at)}</td>
              <td className="p-3">{prof?.full_name || prof?.email || "—"}</td>
              <td className="p-3 font-mono text-xs">{p.license?.license_key ?? "—"}</td>
              <td className="p-3 font-medium">{formatBRL(Number(p.amount))}</td>
              <td className="p-3">{p.paid_at ? formatDate(p.paid_at) : "—"}</td>
              <td className="p-3">
                <Badge variant={statusVariant}>{statusLabel[p.status] ?? p.status}</Badge>
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
                {p.boleto_url && p.status !== "paid" && (
                  <Button size="sm" variant="outline" onClick={() => cancelar(p.id)} disabled={cancelingId === p.id}>
                    <XCircle className="mr-1 h-3.5 w-3.5" /> {cancelingId === p.id ? "Cancelando..." : "Cancelar boleto"}
                  </Button>
                )}
              </td>
            </tr>
            );
          })}
          {filteredPayments.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Nenhum pagamento.</td></tr>}
        </tbody>
      </table>
    </Card>
    </div>
  );
}

// ---------- Customers ----------
const emptyCustomerForm = {
  full_name: "", email: "", password: "",
  cpf_cnpj: "", phone: "",
  address_zip: "", address_street: "", address_number: "",
  address_complement: "", address_neighborhood: "", address_city: "", address_state: "",
};

function CustomersTab({ profiles, licenses, payments, onChange }: { profiles: Profile[]; licenses: LicenseRow[]; payments: PaymentRow[]; onChange: () => void }) {
  const createCustomerFn = useServerFn(createCustomer);
  const updateCustomerFn = useServerFn(updateCustomer);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyCustomerForm);
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<Profile | null>(null);

  const isEdit = !!editing;

  const q = search.trim().toLowerCase();
  const filteredProfiles = !q ? profiles : profiles.filter((p) =>
    (p.full_name || "").toLowerCase().includes(q) ||
    (p.email || "").toLowerCase().includes(q) ||
    (p.cpf_cnpj || "").toLowerCase().includes(q) ||
    String(p.customer_number ?? "").includes(q)
  );

  const detailLicenses = detail ? licenses.filter((l) => l.user_id === detail.user_id) : [];
  const detailPayments = detail ? payments.filter((p) => p.user_id === detail.user_id) : [];
  const detailTotalPaid = detailPayments.filter((p) => p.status === "paid").reduce((s, p) => s + Number(p.amount), 0);
  const detailPending = detailPayments.filter((p) => p.status === "pending").reduce((s, p) => s + Number(p.amount), 0);


  const openCreate = () => {
    setEditing(null);
    setForm(emptyCustomerForm);
    setOpen(true);
  };

  const openEdit = (p: Profile) => {
    setEditing(p);
    setForm({
      full_name: p.full_name ?? "",
      email: p.email ?? "",
      password: "",
      cpf_cnpj: p.cpf_cnpj ? formatCpfCnpj(p.cpf_cnpj) : "",
      phone: p.phone ?? "",
      address_zip: p.address_zip ?? "",
      address_street: p.address_street ?? "",
      address_number: p.address_number ?? "",
      address_complement: p.address_complement ?? "",
      address_neighborhood: p.address_neighborhood ?? "",
      address_city: p.address_city ?? "",
      address_state: p.address_state ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.full_name.trim() || !form.email.trim()) {
      return toast.error("Preencha nome e e-mail");
    }
    if (!isEdit && form.password.length < 6) {
      return toast.error("Informe uma senha com no mínimo 6 caracteres");
    }
    if (isEdit && form.password && form.password.length < 6) {
      return toast.error("A nova senha precisa ter no mínimo 6 caracteres");
    }
    if (!isValidCpfCnpj(form.cpf_cnpj)) {
      return toast.error("CPF ou CNPJ inválido — verifique os dígitos");
    }
    setSaving(true);
    try {
      if (isEdit && editing) {
        await updateCustomerFn({ data: { ...form, user_id: editing.user_id } });
        toast.success("Cliente atualizado");
      } else {
        await createCustomerFn({ data: form });
        toast.success("Cliente cadastrado");
      }
      setOpen(false);
      setEditing(null);
      setForm(emptyCustomerForm);
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Novo cliente</Button>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); setForm(emptyCustomerForm); } }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>{isEdit ? "Editar cliente" : "Cadastrar cliente"}</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2 max-h-[70vh] overflow-y-auto pr-1">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2"><Label>Nome completo / Razão social *</Label>
                  <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
                </div>
                <div className="space-y-2"><Label>CPF / CNPJ *</Label>
                  <Input value={form.cpf_cnpj} onChange={(e) => setForm({ ...form, cpf_cnpj: formatCpfCnpj(e.target.value) })} placeholder="000.000.000-00" />
                </div>
                <div className="space-y-2"><Label>E-mail *</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="space-y-2"><Label>Telefone</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(11) 99999-0000" />
                </div>
                <div className="space-y-2 md:col-span-2"><Label>{isEdit ? "Nova senha (deixe em branco para manter)" : "Senha inicial *"}</Label>
                  <Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="mín. 6 caracteres" />
                </div>
              </div>

              <div className="pt-2 text-xs uppercase tracking-wide text-muted-foreground">Endereço</div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-2"><Label>CEP</Label>
                  <Input
                    value={form.address_zip}
                    onChange={(e) => setForm({ ...form, address_zip: e.target.value })}
                    onBlur={async (e) => {
                      const r = await fetchCep(e.target.value);
                      if (r) setForm((f) => ({ ...f, address_street: r.street || f.address_street, address_neighborhood: r.neighborhood || f.address_neighborhood, address_city: r.city || f.address_city, address_state: r.state || f.address_state }));
                    }}
                  />
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
            <DialogFooter><Button onClick={save} disabled={saving}>{saving ? "Salvando..." : (isEdit ? "Salvar" : "Cadastrar")}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="flex items-center gap-2">
        <Input
          placeholder="Buscar cliente por nome, e-mail, CPF/CNPJ ou ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
      </div>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left"><tr>
            <th className="p-3 font-medium w-16">ID</th>
            <th className="p-3 font-medium">Nome</th>
            <th className="p-3 font-medium">E-mail</th>
            <th className="p-3 font-medium">Cidade</th>
            <th className="p-3 font-medium">UF</th>
            <th className="p-3 font-medium">Licenças</th>
            <th className="p-3 font-medium w-32 text-right">Ações</th>
          </tr></thead>
          <tbody>
            {filteredProfiles.map((p) => {
              const count = licenses.filter((l) => l.user_id === p.user_id).length;
              return (
                <tr key={p.user_id} className="border-t border-border hover:bg-muted/30 cursor-pointer" onClick={() => setDetail(p)}>
                  <td className="p-3 font-mono text-xs text-muted-foreground">#{p.customer_number ?? "—"}</td>
                  <td className="p-3 font-medium">{p.full_name || "—"}</td>
                  <td className="p-3">{p.email}</td>
                  <td className="p-3">{p.address_city || "—"}</td>
                  <td className="p-3">{p.address_state || "—"}</td>
                  <td className="p-3">{count}</td>
                  <td className="p-3 text-right space-x-1" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" onClick={() => setDetail(p)}><DollarSign className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                  </td>
                </tr>
              );
            })}
            {filteredProfiles.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhum cliente.</td></tr>}
          </tbody>
        </table>
      </Card>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detail?.full_name || detail?.email} — Histórico</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-6 py-2">
              <div className="grid grid-cols-3 gap-3">
                <Card className="p-3"><div className="text-xs text-muted-foreground">Pago</div><div className="text-lg font-semibold">{formatBRL(detailTotalPaid)}</div></Card>
                <Card className="p-3"><div className="text-xs text-muted-foreground">Pendente</div><div className="text-lg font-semibold">{formatBRL(detailPending)}</div></Card>
                <Card className="p-3"><div className="text-xs text-muted-foreground">Licenças</div><div className="text-lg font-semibold">{detailLicenses.length}</div></Card>
              </div>

              <div>
                <h3 className="font-medium mb-2">Licenças</h3>
                <Card className="overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left"><tr>
                      <th className="p-2 font-medium">Chave</th>
                      <th className="p-2 font-medium">Produto</th>
                      <th className="p-2 font-medium">Plano</th>
                      <th className="p-2 font-medium">Status</th>
                      <th className="p-2 font-medium">Expira em</th>
                    </tr></thead>
                    <tbody>
                      {detailLicenses.map((l) => (
                        <tr key={l.id} className="border-t border-border">
                          <td className="p-2 font-mono text-xs">{l.license_key}</td>
                          <td className="p-2">{l.product?.name ?? "—"}</td>
                          <td className="p-2">{l.plan}</td>
                          <td className="p-2"><Badge variant="secondary">{statusLabel[l.status] ?? l.status}</Badge></td>
                          <td className="p-2">{formatDate(l.expires_at)}</td>
                        </tr>
                      ))}
                      {detailLicenses.length === 0 && <tr><td colSpan={5} className="p-3 text-center text-muted-foreground">Sem licenças.</td></tr>}
                    </tbody>
                  </table>
                </Card>
              </div>

              <div>
                <h3 className="font-medium mb-2">Financeiro</h3>
                <Card className="overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left"><tr>
                      <th className="p-2 font-medium">Data</th>
                      <th className="p-2 font-medium">Licença</th>
                      <th className="p-2 font-medium">Valor</th>
                      <th className="p-2 font-medium">Pago em</th>
                      <th className="p-2 font-medium">Status</th>
                      <th className="p-2 font-medium">Boleto</th>
                    </tr></thead>
                    <tbody>
                      {detailPayments.map((p) => (
                        <tr key={p.id} className="border-t border-border">
                          <td className="p-2">{formatDate(p.created_at)}</td>
                          <td className="p-2 font-mono text-xs">{p.license?.license_key ?? "—"}</td>
                          <td className="p-2">{formatBRL(Number(p.amount))}</td>
                          <td className="p-2">{p.paid_at ? formatDate(p.paid_at) : "—"}</td>
                          <td className="p-2"><Badge variant={p.status === "paid" ? "default" : p.status === "failed" ? "destructive" : "secondary"}>{statusLabel[p.status] ?? p.status}</Badge></td>
                          <td className="p-2">{p.boleto_url ? <a href={p.boleto_url} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1 text-xs"><FileText className="h-3.5 w-3.5" />Abrir</a> : "—"}</td>
                        </tr>
                      ))}
                      {detailPayments.length === 0 && <tr><td colSpan={6} className="p-3 text-center text-muted-foreground">Sem pagamentos.</td></tr>}
                    </tbody>
                  </table>
                </Card>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
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


// ---------- System Users (admins) ----------
function SystemUsersTab({ profiles, onChange }: { profiles: Profile[]; onChange: () => void }) {
  const createSystemUserFn = useServerFn(createSystemUser);
  const updateSystemUserFn = useServerFn(updateSystemUser);
  const deleteSystemUserFn = useServerFn(deleteSystemUser);
  const { user: currentUser } = useAuth();

  const handleDelete = async (p: Profile) => {
    if (p.user_id === currentUser?.id) {
      return toast.error("Você não pode excluir o próprio usuário");
    }
    if (!confirm(`Excluir o usuário ${p.email}? Esta ação não pode ser desfeita.`)) return;
    try {
      await deleteSystemUserFn({ data: { user_id: p.user_id } });
      toast.success("Usuário excluído");
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir");
    }
  };
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", password: "" });

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [editForm, setEditForm] = useState({ full_name: "", email: "", password: "" });

  const save = async () => {
    if (!form.full_name.trim() || !form.email.trim() || form.password.length < 6) {
      return toast.error("Preencha nome, e-mail e senha (mín. 6 caracteres)");
    }
    setSaving(true);
    try {
      await createSystemUserFn({ data: { ...form, role: "admin" } });
      toast.success("Usuário do sistema cadastrado");
      setOpen(false);
      setForm({ full_name: "", email: "", password: "" });
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao cadastrar");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (p: Profile) => {
    setEditing(p);
    setEditForm({ full_name: p.full_name ?? "", email: p.email ?? "", password: "" });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!editForm.full_name.trim() || !editForm.email.trim()) {
      return toast.error("Preencha nome e e-mail");
    }
    if (editForm.password && editForm.password.length < 6) {
      return toast.error("Senha deve ter no mínimo 6 caracteres");
    }
    setSaving(true);
    try {
      await updateSystemUserFn({
        data: {
          user_id: editing.user_id,
          full_name: editForm.full_name,
          email: editForm.email,
          ...(editForm.password ? { password: editForm.password } : {}),
        },
      });
      toast.success("Usuário atualizado");
      setEditOpen(false);
      setEditing(null);
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Usuários do sistema</h2>
          <p className="text-sm text-muted-foreground">Administradores com acesso ao painel. Não aparecem como clientes.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Novo usuário</Button></DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Cadastrar usuário do sistema</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-2"><Label>Nome completo *</Label>
                <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              </div>
              <div className="space-y-2"><Label>E-mail *</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-2"><Label>Senha inicial *</Label>
                <Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="mín. 6 caracteres" />
              </div>
              <p className="text-xs text-muted-foreground">O usuário será criado com perfil de administrador.</p>
            </div>
            <DialogFooter><Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Cadastrar"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Editar usuário do sistema</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2"><Label>Nome completo *</Label>
              <Input value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} />
            </div>
            <div className="space-y-2"><Label>E-mail *</Label>
              <Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
            </div>
            <div className="space-y-2"><Label>Nova senha</Label>
              <Input type="text" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} placeholder="deixe vazio para não alterar" />
            </div>
          </div>
          <DialogFooter><Button onClick={saveEdit} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left"><tr>
            <th className="p-3 font-medium">Nome</th>
            <th className="p-3 font-medium">E-mail</th>
            <th className="p-3 font-medium">Função</th>
            <th className="p-3 font-medium w-24">Ações</th>
          </tr></thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.user_id} className="border-t border-border">
                <td className="p-3 font-medium">{p.full_name || "—"}</td>
                <td className="p-3">{p.email}</td>
                <td className="p-3"><Badge variant="outline">admin</Badge></td>
                <td className="p-3">
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(p)} title="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(p)}
                      disabled={p.user_id === currentUser?.id}
                      title={p.user_id === currentUser?.id ? "Não é possível excluir o próprio usuário" : "Excluir"}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {profiles.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Nenhum usuário do sistema.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function MobileAppTab() {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (typeof window !== "undefined") setUrl(window.location.origin);
  }, []);

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    toast.success("Link copiado");
  };

  return (
    <Card className="p-6">
      <div className="flex flex-col items-center gap-6 md:flex-row md:items-start">
        <div className="rounded-lg bg-white p-4 shadow-sm">
          {url ? <QRCodeSVG value={url} size={200} level="M" /> : <div className="h-[200px] w-[200px]" />}
        </div>
        <div className="flex-1 space-y-3">
          <h3 className="text-lg font-semibold">Acesso ao App Mobile</h3>
          <p className="text-sm text-muted-foreground">
            Escaneie o QR Code com a câmera do celular para abrir o aplicativo no domínio configurado nesta instalação.
          </p>
          <div className="flex items-center gap-2">
            <Input readOnly value={url} />
            <Button variant="outline" size="icon" onClick={copy}><Copy className="h-4 w-4" /></Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
