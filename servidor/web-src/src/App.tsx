import { Navigate, Route, Routes, Link, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import { LoginPage } from "./pages/Login";
import { AdminPage } from "./pages/Admin";
import { DashboardPage } from "./pages/Dashboard";
import { AccountPage } from "./pages/Account";

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
  return <div className="h-screen grid place-items-center text-slate-600">{children}</div>;
}

function Home() {
  const { me } = useAuth();
  return <Navigate to={me?.role === "admin" ? "/admin" : "/dashboard"} replace />;
}

function Shell() {
  const { me, logout } = useAuth();
  const nav = useNavigate();
  const isAdmin = me?.role === "admin";
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-white">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="font-bold text-slate-800">GetLicence</Link>
          <nav className="flex gap-4 text-sm">
            {isAdmin && <Link className="hover:text-blue-600" to="/admin">Admin</Link>}
            <Link className="hover:text-blue-600" to="/dashboard">Painel</Link>
            <Link className="hover:text-blue-600" to="/account">Minha conta</Link>
            <button
              className="text-slate-500 hover:text-red-600"
              onClick={async () => { await logout(); nav("/login"); }}
            >Sair</button>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <div className="max-w-6xl mx-auto p-4">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

// Importação tardia evita ciclo
import { Outlet } from "react-router-dom";
