import { useEffect, useState, type FormEvent } from "react";
import { api, type Me } from "../api";
import { Button, Card, Field, Input } from "../ui";

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
    try {
      await api.put("/api/profile", form);
      setMsg("Perfil atualizado.");
    } catch (e) { setErr((e as Error).message); }
  }

  async function changePw(e: FormEvent) {
    e.preventDefault(); setErr(null); setMsg(null);
    try {
      await api.post("/api/auth/change-password", pw);
      setMsg("Senha alterada.");
      setPw({ current_password: "", new_password: "" });
    } catch (e) { setErr((e as Error).message); }
  }

  if (!me) return <p>Carregando…</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Minha conta</h1>
      {msg && <div className="bg-green-50 text-green-700 p-3 rounded text-sm">{msg}</div>}
      {err && <div className="bg-red-50 text-red-700 p-3 rounded text-sm">{err}</div>}

      <Card>
        <form onSubmit={saveProfile} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Nome completo"><Input value={form.full_name ?? ""} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
          <Field label="CPF/CNPJ"><Input value={form.cpf_cnpj ?? ""} onChange={(e) => setForm({ ...form, cpf_cnpj: e.target.value })} /></Field>
          <Field label="Telefone"><Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="CEP"><Input value={form.address_zip ?? ""} onChange={(e) => setForm({ ...form, address_zip: e.target.value })} /></Field>
          <Field label="Rua"><Input value={form.address_street ?? ""} onChange={(e) => setForm({ ...form, address_street: e.target.value })} /></Field>
          <Field label="Número"><Input value={form.address_number ?? ""} onChange={(e) => setForm({ ...form, address_number: e.target.value })} /></Field>
          <Field label="Complemento"><Input value={form.address_complement ?? ""} onChange={(e) => setForm({ ...form, address_complement: e.target.value })} /></Field>
          <Field label="Bairro"><Input value={form.address_neighborhood ?? ""} onChange={(e) => setForm({ ...form, address_neighborhood: e.target.value })} /></Field>
          <Field label="Cidade"><Input value={form.address_city ?? ""} onChange={(e) => setForm({ ...form, address_city: e.target.value })} /></Field>
          <Field label="UF"><Input maxLength={2} value={form.address_state ?? ""} onChange={(e) => setForm({ ...form, address_state: e.target.value.toUpperCase() })} /></Field>
          <div className="md:col-span-2"><Button type="submit">Salvar perfil</Button></div>
        </form>
      </Card>

      <Card>
        <h2 className="font-semibold mb-3">Trocar senha</h2>
        <form onSubmit={changePw} className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-md">
          <Field label="Senha atual"><Input type="password" required value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} /></Field>
          <Field label="Nova senha (mín. 8)"><Input type="password" required minLength={8} value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} /></Field>
          <div className="md:col-span-2"><Button type="submit">Atualizar senha</Button></div>
        </form>
      </Card>
    </div>
  );
}
