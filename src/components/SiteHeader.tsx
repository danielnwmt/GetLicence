import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { KeyRound, LogOut } from "lucide-react";

export function SiteHeader() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isAdmin = pathname === "/admin";
  const linkCls = "inline-flex items-center rounded-md border border-transparent px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground";
  const activeLinkCls = linkCls + " border-primary text-foreground";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center gap-4 px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground shadow-elevated">
            <KeyRound className="h-4 w-4" />
          </div>
          <span className="text-lg">Get<span className="text-primary">Licence</span></span>
        </Link>
        <div id="site-header-center" className="flex flex-1 justify-center px-4">
          {user && !isAdmin && role === "admin" && (
            <div className="flex items-center gap-1">
              <Link to="/admin" className={linkCls}>Dashboard</Link>
              <Link to="/admin" className={linkCls}>Clientes</Link>
              <Link to="/admin" className={linkCls}>Licenças</Link>
              <Link to="/dashboard" className={pathname === "/dashboard" ? activeLinkCls : linkCls}>Minhas licenças</Link>
              <Link to="/admin" className={linkCls}>Integrações</Link>
              <Link to="/admin" className={linkCls}>Financeiro</Link>
              <Link to="/account" className={pathname === "/account" ? activeLinkCls : linkCls}>Configuração</Link>
            </div>
          )}
        </div>
        <nav className="flex items-center gap-2">
          {user ? (
            <>
              {!isAdmin && role !== "admin" && (
                <>
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/dashboard">Minhas licenças</Link>
                  </Button>
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/account">Conta</Link>
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await signOut();
                  navigate({ to: "/" });
                }}
              >
                <LogOut className="mr-2 h-4 w-4" /> Sair
              </Button>
            </>
          ) : (
            <Button asChild size="sm">
              <Link to="/auth">Entrar</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
