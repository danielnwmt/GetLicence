import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/change-password")({
  component: ChangePasswordPage,
});

function ChangePasswordPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.length < 8) return toast.error("Mínimo de 8 caracteres.");
    if (pwd !== pwd2) return toast.error("As senhas não coincidem.");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    if (error) {
      setLoading(false);
      return toast.error(error.message);
    }
    if (user) {
      await supabase
        .from("profiles")
        .update({ must_change_password: false })
        .eq("user_id", user.id);
    }
    toast.success("Senha atualizada!");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Trocar senha</CardTitle>
          <CardDescription>Por segurança, defina uma nova senha para continuar.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pwd">Nova senha</Label>
              <Input
                id="pwd"
                type="password"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pwd2">Confirmar senha</Label>
              <Input
                id="pwd2"
                type="password"
                value={pwd2}
                onChange={(e) => setPwd2(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Salvando..." : "Salvar nova senha"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
