import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { Button, Card, CardContent, CardHeader, CardTitle, CardDescription, Field, Input } from "../ui";
import { KeyRound } from "lucide-react";

export function LoginPage() {
  const { login, me } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (me?.user) { nav("/", { replace: true }); }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await login(email, password);
      nav("/", { replace: true });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-background p-4 bg-gradient-hero/5 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-hero opacity-10 pointer-events-none" />
      <Card className="w-full max-w-sm relative">
        <CardHeader className="text-center items-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-elevated">
            <KeyRound className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">Get<span className="text-primary">Licence</span></CardTitle>
          <CardDescription>Entre com seu email e senha.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <Field label="Email" htmlFor="email">
              <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Senha" htmlFor="pwd">
              <Input id="pwd" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            {err && <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">{err}</div>}
            <Button type="submit" disabled={loading} className="w-full">{loading ? "Entrando…" : "Entrar"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
