import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KeyRound, Calendar, CreditCard, Package, Copy, Check, FileText, Server, HardDrive, ArrowUpCircle } from "lucide-react";
import { formatBRL, formatDate, statusLabel } from "@/lib/format";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Minhas licenças — GetLicence" }] }),
  component: Dashboard,
});

interface License {
  id: string;
  user_id: string;
  license_key: string;
  plan: string;
  status: string;
  starts_at: string;
  expires_at: string;
  extra_storage_gb: number | null;
  product: {
    name: string;
    description: string | null;
    vps_specs: string | null;
    vps_storage_amount: number | null;
    vps_storage_unit: string | null;
    storage_amount: number | null;
    storage_unit: string | null;
  } | null;
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
  const [upgradeLicense, setUpgradeLicense] = useState<License | null>(null);
  const [upgradeAmount, setUpgradeAmount] = useState<string>("100");
  const [upgradeSubmitting, setUpgradeSubmitting] = useState(false);
  const [vpsUpgradeLicense, setVpsUpgradeLicense] = useState<License | null>(null);
  const [vpsUpgradePlan, setVpsUpgradePlan] = useState<string>("2vcpu-4gb");
  const [vpsUpgradeSubmitting, setVpsUpgradeSubmitting] = useState(false);
  const [customerName, setCustomerName] = useState<string>("");
  const [customerNames, setCustomerNames] = useState<Record<string, string>>({});

  const upgradeOptions = [
    { value: "50", label: "+50 GB" },
    { value: "100", label: "+100 GB" },
    { value: "250", label: "+250 GB" },
    { value: "500", label: "+500 GB" },
    { value: "1000", label: "+1 TB" },
  ];

  const vpsUpgradeOptions = [
    { value: "2vcpu-4gb", label: "2 vCPU • 4 GB RAM" },
    { value: "4vcpu-8gb", label: "4 vCPU • 8 GB RAM" },
    { value: "6vcpu-16gb", label: "6 vCPU • 16 GB RAM" },
    { value: "8vcpu-32gb", label: "8 vCPU • 32 GB RAM" },
    { value: "16vcpu-64gb", label: "16 vCPU • 64 GB RAM" },
  ];

  const submitUpgrade = async () => {
    if (!upgradeLicense) return;
    setUpgradeSubmitting(true);
    try {
      const add = Number(upgradeAmount) || 0;
      const current = Number(upgradeLicense.extra_storage_gb ?? 0);
      const newExtra = current + add;
      const { error } = await supabase
        .from("licenses")
        .update({ extra_storage_gb: newExtra })
        .eq("id", upgradeLicense.id);
      if (error) throw error;
      setLicenses((prev) => prev.map((x) => x.id === upgradeLicense.id ? { ...x, extra_storage_gb: newExtra } : x));
      toast.success(`Upgrade aplicado: +${add} GB (total extra: ${newExtra} GB).`);
      setUpgradeLicense(null);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao aplicar upgrade");
    } finally {
      setUpgradeSubmitting(false);
    }
  };

  const submitVpsUpgrade = async () => {
    if (!vpsUpgradeLicense) return;
    setVpsUpgradeSubmitting(true);
    try {
      await new Promise((r) => setTimeout(r, 600));
      toast.success("Solicitação de upgrade de VPS enviada. Em breve entraremos em contato.");
      setVpsUpgradeLicense(null);
    } finally {
      setVpsUpgradeSubmitting(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();
      setCustomerName((prof as any)?.full_name || user.email || "");

      const { data: lic } = await supabase
        .from("licenses")
        .select("id, user_id, license_key, plan, status, starts_at, expires_at, extra_storage_gb, product:products(name, description, vps_specs, vps_storage_amount, vps_storage_unit, storage_amount, storage_unit)")
        .order("created_at", { ascending: false });
      const licList = (lic as unknown as License[]) || [];
      setLicenses(licList);

      const ids = Array.from(new Set(licList.map((l) => l.user_id).filter(Boolean)));
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, full_name, email")
          .in("user_id", ids);
        const map: Record<string, string> = {};
        (profs || []).forEach((p: any) => { map[p.user_id] = p.full_name || p.email || ""; });
        setCustomerNames(map);
      }

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
    blocked: "bg-destructive/15 text-destructive border-destructive/30",
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
                    {(customerNames[l.user_id] || customerName) && (
                      <div className="mt-1 text-sm text-muted-foreground">{customerNames[l.user_id] || customerName}</div>
                    )}
                  </div>
                  <Badge className={statusVariant[l.status]} variant="outline">{statusLabel[l.status]}</Badge>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Expira em {formatDate(l.expires_at)}</span>
                  <span className="capitalize">{l.plan === "monthly" ? "Mensal" : l.plan === "semestral" ? "Semestral" : "Anual"}</span>
                </div>
                {(l.product?.vps_specs || Number(l.product?.vps_storage_amount) > 0 || Number(l.product?.storage_amount) > 0) && (
                  <div className="mt-4 grid gap-2 rounded-md border border-border/60 bg-muted/30 p-3 text-sm sm:grid-cols-2">
                    {l.product?.vps_specs && (
                      <div className="flex items-start gap-2">
                        <Server className="mt-0.5 h-4 w-4 text-primary" />
                        <div>
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">VPS</div>
                          <div className="font-medium">{l.product.vps_specs}</div>
                        </div>
                      </div>
                    )}
                    {Number(l.product?.vps_storage_amount) > 0 && (
                      <div className="flex items-start gap-2">
                        <HardDrive className="mt-0.5 h-4 w-4 text-primary" />
                        <div>
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">Disco VPS</div>
                          <div className="font-medium">{Number(l.product?.vps_storage_amount)} {l.product?.vps_storage_unit}</div>
                        </div>
                      </div>
                    )}
                    {(Number(l.product?.storage_amount) > 0 || Number(l.extra_storage_gb) > 0) && (
                      <div className="flex items-start gap-2">
                        <HardDrive className="mt-0.5 h-4 w-4 text-primary" />
                        <div>
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">Armazenamento</div>
                          <div className="font-medium">
                            {Number(l.product?.storage_amount ?? 0) + Number(l.extra_storage_gb ?? 0)} {l.product?.storage_unit ?? "GB"}
                            {Number(l.extra_storage_gb) > 0 && (
                              <span className="ml-1 text-xs text-muted-foreground">({Number(l.product?.storage_amount ?? 0)} + {Number(l.extra_storage_gb)} extra)</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => copyKey(l.license_key)}>
                    {copied === l.license_key ? <Check className="mr-2 h-3.5 w-3.5" /> : <Copy className="mr-2 h-3.5 w-3.5" />}
                    Copiar chave
                  </Button>
                  <Button size="sm" onClick={() => { setUpgradeLicense(l); setUpgradeAmount("100"); }}>
                    <ArrowUpCircle className="mr-2 h-3.5 w-3.5" />
                    Upgrade de armazenamento
                  </Button>
                  {l.product?.vps_specs && (
                    <Button size="sm" variant="secondary" onClick={() => { setVpsUpgradeLicense(l); setVpsUpgradePlan("4vcpu-8gb"); }}>
                      <Server className="mr-2 h-3.5 w-3.5" />
                      Upgrade de VPS
                    </Button>
                  )}
                </div>
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

      <Dialog open={!!upgradeLicense} onOpenChange={(o) => !o && setUpgradeLicense(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upgrade de armazenamento</DialogTitle>
            <DialogDescription>
              {upgradeLicense?.product?.name} — {upgradeLicense?.license_key}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <div className="text-muted-foreground">Armazenamento atual</div>
              <div className="font-medium">
                {Number(upgradeLicense?.product?.storage_amount ?? 0) + Number(upgradeLicense?.extra_storage_gb ?? 0)} {upgradeLicense?.product?.storage_unit ?? "GB"}
                {Number(upgradeLicense?.extra_storage_gb) > 0 && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({Number(upgradeLicense?.product?.storage_amount ?? 0)} base + {Number(upgradeLicense?.extra_storage_gb)} extra)
                  </span>
                )}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Após o upgrade: {Number(upgradeLicense?.product?.storage_amount ?? 0) + Number(upgradeLicense?.extra_storage_gb ?? 0) + Number(upgradeAmount || 0)} {upgradeLicense?.product?.storage_unit ?? "GB"}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Quanto deseja adicionar?</Label>
              <Select value={upgradeAmount} onValueChange={setUpgradeAmount}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {upgradeOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                A cobrança proporcional será calculada e enviada por boleto.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpgradeLicense(null)}>Cancelar</Button>
            <Button onClick={submitUpgrade} disabled={upgradeSubmitting}>
              {upgradeSubmitting ? "Enviando..." : "Solicitar upgrade"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!vpsUpgradeLicense} onOpenChange={(o) => !o && setVpsUpgradeLicense(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upgrade de VPS</DialogTitle>
            <DialogDescription>
              {vpsUpgradeLicense?.product?.name} — {vpsUpgradeLicense?.license_key}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <div className="text-muted-foreground">VPS atual</div>
              <div className="font-medium">{vpsUpgradeLicense?.product?.vps_specs || "—"}</div>
            </div>
            <div className="space-y-1.5">
              <Label>Nova configuração</Label>
              <Select value={vpsUpgradePlan} onValueChange={setVpsUpgradePlan}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {vpsUpgradeOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                A cobrança proporcional será calculada e enviada por boleto.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVpsUpgradeLicense(null)}>Cancelar</Button>
            <Button onClick={submitVpsUpgrade} disabled={vpsUpgradeSubmitting}>
              {vpsUpgradeSubmitting ? "Enviando..." : "Solicitar upgrade"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
