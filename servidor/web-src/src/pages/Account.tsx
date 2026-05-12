import { useEffect, useState, type FormEvent } from "react";
import { api, type Me } from "../api";
import { Button, Card, CardContent, CardHeader, CardTitle, Field, Input } from "../ui";
import { KeyRound, User } from "lucide-react";

export function AccountPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [pw, setPw] = useState({ current_password: "", new_password: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.get<Me>("/api/auth/me").then((d) => {
      setMe(d);
      const u = d.user ?? {};
      setForm({
        full_name: u.full_name ?? "",
        cpf_cnpj: u.cpf_cnpj ?? "",
        phone: u.phone ?? "",
        address_zip: u.address_zip ?? "",
        address_street: u.address_street ?? "",
        address_number: u.address_number ?? "",
        address_complement: u.address_complement ?? "",
        address_neighborhood: u.address_neighborhood ?? "",
        address_city: u.address_city ?? "",
        address_state: u.address_state ?? "",
      });
    });
  }, []);

  async function saveProfile(e: FormEvent) {
    e.preventDefault(); setErr(null); setMsg(null);
    try { await api.put("/api/profile", form); setMsg("Dados atualizados."); }
    catch (e) { setErr((e as Error).message); }
  }

  async function changePw(e: FormEvent) {
    e.preventDefault(); setErr(null); setMsg(null);
    try {
      await api.post("/api/auth/change-password", pw);
      setMsg("Senha alterada.");
      setPw({ current_password: "", new_password: "" });
    } catch (e) { setErr((e as Error).message); }
  }

  if (!me) return <p className="text-muted-foreground">Carregando…</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Minha conta</h1>
        <p className="text-muted-foreground">Mantenha seus dados de cobrança atualizados.</p>
      </div>

      {msg && <div className="rounded-md border border-success/30 bg-success/10 p-3 text-sm text-success">{msg}</div>}
      {err && <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{err}</div>}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><User className="h-5 w-5 text-primary" /> Dados de cobrança</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Nome completo / Razão social"><Input value={form.full_name ?? ""} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
              <Field label="CPF / CNPJ"><Input value={form.cpf_cnpj ?? ""} onChange={(e) => setForm({ ...form, cpf_cnpj: e.target.value })} /></Field>
              <Field label="Telefone"><Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
              <Field label="CEP"><Input value={form.address_zip ?? ""} onChange={(e) => setForm({ ...form, address_zip: e.target.value })} /></Field>
            </div>
            <div className="pt-2 text-xs uppercase tracking-wide text-muted-foreground">Endereço</div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="md:col-span-2"><Field label="Rua / Logradouro"><Input value={form.address_street ?? ""} onChange={(e) => setForm({ ...form, address_street: e.target.value })} /></Field></div>
              <Field label="Número"><Input value={form.address_number ?? ""} onChange={(e) => setForm({ ...form, address_number: e.target.value })} /></Field>
              <Field label="Complemento"><Input value={form.address_complement ?? ""} onChange={(e) => setForm({ ...form, address_complement: e.target.value })} /></Field>
              <Field label="Bairro"><Input value={form.address_neighborhood ?? ""} onChange={(e) => setForm({ ...form, address_neighborhood: e.target.value })} /></Field>
              <Field label="Cidade"><Input value={form.address_city ?? ""} onChange={(e) => setForm({ ...form, address_city: e.target.value })} /></Field>
              <Field label="UF"><Input maxLength={2} value={form.address_state ?? ""} onChange={(e) => setForm({ ...form, address_state: e.target.value.toUpperCase() })} /></Field>
            </div>
            <Button type="submit">Salvar dados</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" /> Alterar senha</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={changePw} className="space-y-4 max-w-md">
            <Field label="Senha atual"><Input type="password" required value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} /></Field>
            <Field label="Nova senha (mín. 8)"><Input type="password" required minLength={8} value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} /></Field>
            <Button type="submit">Atualizar senha</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
