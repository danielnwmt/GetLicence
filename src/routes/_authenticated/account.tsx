import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SiteHeader } from "@/components/SiteHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({ meta: [{ title: "Minha conta — LicençaHub" }] }),
  component: AccountPage,
});

const pwdSchema = z.string().min(6, "Mínimo 6 caracteres").max(72);

function AccountPage() {
  const { user } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
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
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto max-w-2xl px-4 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Minha conta</h1>
          <p className="text-muted-foreground">Gerencie suas credenciais de acesso</p>
        </div>

        <Card className="p-6 mb-6">
          <h2 className="text-sm font-medium text-muted-foreground mb-1">E-mail</h2>
          <p className="font-medium">{user?.email}</p>
        </Card>

        <Card className="p-6">
          <div className="mb-4 flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Alterar senha</h2>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-pwd">Nova senha</Label>
              <Input
                id="new-pwd"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-pwd">Confirmar nova senha</Label>
              <Input
                id="confirm-pwd"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? "Salvando..." : "Atualizar senha"}
            </Button>
          </form>
        </Card>
      </main>
    </div>
  );
}
