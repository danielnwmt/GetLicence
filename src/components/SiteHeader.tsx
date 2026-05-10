import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { KeyRound, LogOut } from "lucide-react";

export function SiteHeader() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground shadow-elevated">
            <KeyRound className="h-4 w-4" />
          </div>
          <span className="text-lg">Licença<span className="text-primary">Hub</span></span>
        </Link>
        <nav className="flex items-center gap-2">
          {user ? (
            <>
              {role === "admin" && (
                <Button asChild variant="ghost" size="sm">
                  <Link to="/admin">Admin</Link>
                </Button>
              )}
              <Button asChild variant="ghost" size="sm">
                <Link to="/dashboard">Minhas licenças</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link to="/account">Conta</Link>
              </Button>
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
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/auth">Entrar</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/auth">Começar</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
