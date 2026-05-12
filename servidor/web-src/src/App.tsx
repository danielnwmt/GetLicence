import { Navigate, Route, Routes, Link, useNavigate, useLocation, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import { LoginPage } from "./pages/Login";
import { AdminPage } from "./pages/Admin";
import { DashboardPage } from "./pages/Dashboard";
import { AccountPage } from "./pages/Account";
import { Button } from "./ui";
import { KeyRound, LogOut } from "lucide-react";

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Protected><Shell /></Protected>}>
          <Route index element={<Home />} />
          <Route path="admin" element={<RequireAdmin><AdminPage /></RequireAdmin>} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="account" element={<AccountPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

function Protected({ children }: { children: React.ReactNode }) {
  const { me, loading } = useAuth();
  if (loading) return <FullScreen>Carregando…</FullScreen>;
  if (!me?.user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { me } = useAuth();
  if (me?.role !== "admin") return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function FullScreen({ children }: { children: React.ReactNode }) {
  return <div className="h-screen grid place-items-center text-muted-foreground">{children}</div>;
}

function Home() {
  const { me } = useAuth();
  return <Navigate to={me?.role === "admin" ? "/admin" : "/dashboard"} replace />;
}

function Shell() {
  const { me, logout } = useAuth();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const isAdmin = me?.role === "admin";
  const linkCls = "inline-flex items-center rounded-md border border-transparent px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors";
  const activeLinkCls = linkCls + " border-primary text-foreground bg-background";
  const isActive = (p: string) => pathname === p;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center gap-4 px-4 max-w-6xl">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground shadow-elevated">
              <KeyRound className="h-4 w-4" />
            </div>
            <span className="text-lg">Get<span className="text-primary">Licence</span></span>
          </Link>
          <div className="flex flex-1 justify-center px-4">
            {isAdmin && (
              <div className="flex items-center gap-1">
                <Link to="/admin" className={isActive("/admin") ? activeLinkCls : linkCls}>Admin</Link>
                <Link to="/dashboard" className={isActive("/dashboard") ? activeLinkCls : linkCls}>Minhas licenças</Link>
                <Link to="/account" className={isActive("/account") ? activeLinkCls : linkCls}>Configuração</Link>
              </div>
            )}
          </div>
          <nav className="flex items-center gap-2">
            {!isAdmin && (
              <>
                <Button asChild={false} variant="ghost" size="sm" onClick={() => nav("/dashboard")}>Minhas licenças</Button>
                <Button asChild={false} variant="ghost" size="sm" onClick={() => nav("/account")}>Configuração</Button>
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={async () => { await logout(); nav("/login"); }}
            >
              <LogOut className="h-4 w-4" /> Sair
            </Button>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <div className="container mx-auto max-w-6xl px-4 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
