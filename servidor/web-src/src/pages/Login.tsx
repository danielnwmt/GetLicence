import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { Button, Field, Input } from "../ui";

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
    <div className="min-h-screen grid place-items-center bg-slate-50 p-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm bg-white border rounded-lg p-6 space-y-4">
        <h1 className="text-2xl font-bold text-slate-800">Axis Licenças</h1>
        <p className="text-sm text-slate-500">Entre com seu email e senha.</p>
        <Field label="Email"><Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Senha"><Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        {err && <div className="bg-red-50 text-red-700 text-sm p-2 rounded">{err}</div>}
        <Button type="submit" disabled={loading} className="w-full">{loading ? "Entrando…" : "Entrar"}</Button>
      </form>
    </div>
  );
}
