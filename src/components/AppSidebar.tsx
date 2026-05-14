"use client";

import * as React from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  KeyRound,
  CreditCard,
  Package,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  UserCircle,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  to: string;
  search?: Record<string, string>;
  icon: React.ComponentType<{ className?: string }>;
  match: (pathname: string, search: Record<string, unknown>) => boolean;
}

const adminItems: NavItem[] = [
  { label: "Dashboard", to: "/admin", icon: LayoutDashboard, match: (p, s) => p === "/admin" && !s.tab },
  { label: "Clientes", to: "/admin", search: { tab: "customers" }, icon: Users, match: (p, s) => p === "/admin" && s.tab === "customers" },
  { label: "Licenças", to: "/admin", search: { tab: "licenses" }, icon: KeyRound, match: (p, s) => p === "/admin" && s.tab === "licenses" },
  { label: "Minhas licenças", to: "/dashboard", icon: KeyRound, match: (p) => p === "/dashboard" },
  { label: "Financeiro", to: "/admin", search: { tab: "payments" }, icon: CreditCard, match: (p, s) => p === "/admin" && s.tab === "payments" },
  { label: "Contas a Pagar", to: "/admin", search: { tab: "payables" }, icon: Receipt, match: (p, s) => p === "/admin" && s.tab === "payables" },
  { label: "Produtos", to: "/admin", search: { tab: "products" }, icon: Package, match: (p, s) => p === "/admin" && s.tab === "products" },
  { label: "Configurações", to: "/admin", search: { tab: "settings" }, icon: Settings, match: (p, s) => p === "/admin" && s.tab === "settings" },
];

const clientItems: NavItem[] = [
  { label: "Minhas licenças", to: "/dashboard", icon: KeyRound, match: (p) => p === "/dashboard" },
  { label: "Configurações", to: "/account", icon: UserCircle, match: (p) => p === "/account" },
];

export function AppSidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const { location } = useRouterState();
  const pathname = location.pathname;
  const search = (location.search ?? {}) as Record<string, unknown>;

  const items = role === "admin" ? adminItems : clientItems;

  return (
    <aside
      className={cn(
        "sticky top-0 flex h-screen flex-col border-r border-border/60 bg-background transition-[width] duration-200",
        collapsed ? "w-16" : "w-60"
      )}
    >
      <div className="flex h-16 items-center gap-2 border-b border-border/60 px-3">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground shadow-elevated">
            <KeyRound className="h-4 w-4" />
          </div>
          {!collapsed && (
            <span className="text-lg font-extrabold tracking-tight text-foreground">
              Get<span className="text-primary">Licence</span>
            </span>
          )}
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {items.map((item) => {
          const active = item.match(pathname, search);
          const Icon = item.icon;
          return (
            <Link
              key={item.label + item.to + (item.search?.tab ?? "")}
              to={item.to}
              search={item.search ?? {}}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                collapsed && "justify-center px-0"
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border/60 p-2">
        {user && (
          <Button
            variant="ghost"
            size="sm"
            className={cn("w-full justify-start gap-3", collapsed && "justify-center px-0")}
            onClick={async () => {
              await signOut();
              navigate({ to: "/" });
            }}
            title={collapsed ? "Sair" : undefined}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Sair</span>}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className={cn("mt-1 w-full justify-start gap-3", collapsed && "justify-center px-0")}
          onClick={onToggle}
          title={collapsed ? "Expandir" : "Recolher"}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          {!collapsed && <span>Recolher</span>}
        </Button>
      </div>
    </aside>
  );
}
