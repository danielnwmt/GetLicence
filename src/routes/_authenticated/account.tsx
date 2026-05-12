import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { fetchCep } from "@/lib/cep";
import { KeyRound, User } from "lucide-react";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({ meta: [{ title: "Minha conta — GetLicence" }] }),
  component: AccountPage,
});

const pwdSchema = z.string().min(6, "Mínimo 6 caracteres").max(72);

interface ProfileForm {
  full_name: string;
  cpf_cnpj: string;
  phone: string;
  address_zip: string;
  address_street: string;
  address_number: string;
  address_complement: string;
  address_neighborhood: string;
  address_city: string;
  address_state: string;
}

const empty: ProfileForm = {
  full_name: "", cpf_cnpj: "", phone: "",
  address_zip: "", address_street: "", address_number: "",
  address_complement: "", address_neighborhood: "", address_city: "", address_state: "",
};

function AccountPage() {
  const { user } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const [profile, setProfile] = useState<ProfileForm>(empty);
  const [profileSaving, setProfileSaving] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      return toast.error("Informe um e-mail válido");
    }
    setEmailBusy(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    setEmailBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Enviamos um link de confirmação para o novo e-mail.");
    setNewEmail("");
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, cpf_cnpj, phone, address_zip, address_street, address_number, address_complement, address_neighborhood, address_city, address_state")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setProfile({
          full_name: data.full_name ?? "",
          cpf_cnpj: data.cpf_cnpj ?? "",
          phone: data.phone ?? "",
          address_zip: data.address_zip ?? "",
          address_street: data.address_street ?? "",
          address_number: data.address_number ?? "",
          address_complement: data.address_complement ?? "",
          address_neighborhood: data.address_neighborhood ?? "",
          address_city: data.address_city ?? "",
          address_state: data.address_state ?? "",
        });
      }
    })();
  }, [user]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (profile.cpf_cnpj.replace(/\D/g, "").length < 11) {
      return toast.error("Informe um CPF ou CNPJ válido");
    }
    setProfileSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: profile.full_name,
        cpf_cnpj: profile.cpf_cnpj.replace(/\D/g, ""),
        phone: profile.phone || null,
        address_zip: profile.address_zip || null,
        address_street: profile.address_street || null,
        address_number: profile.address_number || null,
        address_complement: profile.address_complement || null,
        address_neighborhood: profile.address_neighborhood || null,
        address_city: profile.address_city || null,
        address_state: profile.address_state || null,
      })
      .eq("user_id", user.id);
    setProfileSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Dados atualizados");
  };

  const submitPwd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      pwdSchema.parse(password);
    } catch (err) {
      if (err instanceof z.ZodError) return toast.error(err.issues[0].message);
    }
    if (password !== confirm) return toast.error("As senhas não conferem");

    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Senha alterada com sucesso!");
    setPassword("");
    setConfirm("");
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Minha conta</h1>
        <p className="text-muted-foreground">Mantenha seus dados de cobrança atualizados para emitir boletos.</p>
      </div>

      <Card className="p-6 mb-6">
        <h2 className="text-sm font-medium text-muted-foreground mb-1">E-mail atual</h2>
        <p className="font-medium mb-4">{user?.email}</p>
        <form onSubmit={submitEmail} className="space-y-3 border-t border-border pt-4">
          <Label htmlFor="new-email">Alterar e-mail</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="new-email"
              type="email"
              placeholder="novo@email.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
            />
            <Button type="submit" disabled={emailBusy}>
              {emailBusy ? "Enviando..." : "Atualizar e-mail"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Você receberá um link de confirmação no novo endereço.
          </p>
        </form>
      </Card>

      <Card className="p-6 mb-6">
        <div className="mb-4 flex items-center gap-2">
          <User className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Dados de cobrança</h2>
        </div>
        <form onSubmit={saveProfile} className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Nome completo / Razão social</Label>
              <Input value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>CPF / CNPJ *</Label>
              <Input value={profile.cpf_cnpj} onChange={(e) => setProfile({ ...profile, cpf_cnpj: e.target.value })} placeholder="Somente números" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Telefone</Label>
              <Input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
            </div>
          </div>
          <div className="pt-2 text-xs uppercase tracking-wide text-muted-foreground">Endereço</div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2"><Label>CEP</Label>
              <Input value={profile.address_zip} onChange={(e) => setProfile({ ...profile, address_zip: e.target.value })} />
            </div>
            <div className="space-y-2 md:col-span-2"><Label>Rua / Logradouro</Label>
              <Input value={profile.address_street} onChange={(e) => setProfile({ ...profile, address_street: e.target.value })} />
            </div>
            <div className="space-y-2"><Label>Número</Label>
              <Input value={profile.address_number} onChange={(e) => setProfile({ ...profile, address_number: e.target.value })} />
            </div>
            <div className="space-y-2"><Label>Complemento</Label>
              <Input value={profile.address_complement} onChange={(e) => setProfile({ ...profile, address_complement: e.target.value })} />
            </div>
            <div className="space-y-2"><Label>Bairro</Label>
              <Input value={profile.address_neighborhood} onChange={(e) => setProfile({ ...profile, address_neighborhood: e.target.value })} />
            </div>
            <div className="space-y-2 md:col-span-2"><Label>Cidade</Label>
              <Input value={profile.address_city} onChange={(e) => setProfile({ ...profile, address_city: e.target.value })} />
            </div>
            <div className="space-y-2"><Label>UF</Label>
              <Input maxLength={2} value={profile.address_state} onChange={(e) => setProfile({ ...profile, address_state: e.target.value.toUpperCase() })} />
            </div>
          </div>
          <Button type="submit" disabled={profileSaving}>{profileSaving ? "Salvando..." : "Salvar dados"}</Button>
        </form>
      </Card>

      <Card className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Alterar senha</h2>
        </div>
        <form onSubmit={submitPwd} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-pwd">Nova senha</Label>
            <Input id="new-pwd" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-pwd">Confirmar nova senha</Label>
            <Input id="confirm-pwd" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} />
          </div>
          <Button type="submit" disabled={busy}>{busy ? "Salvando..." : "Atualizar senha"}</Button>
        </form>
      </Card>
    </div>
  );
}
