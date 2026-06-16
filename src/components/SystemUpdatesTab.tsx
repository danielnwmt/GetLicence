import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, GitBranch, Server } from "lucide-react";
import { toast } from "sonner";

const CURRENT_VERSION = "v1.0.0";

type UpdateStatus = "pending" | "processing" | "success" | "failed";

interface SystemUpdate {
  id: string;
  status: UpdateStatus;
  version: string | null;
  message: string | null;
  created_at: string;
}

export function SystemUpdatesTab() {
  const { user } = useAuth();
  const [updateId, setUpdateId] = useState<string | null>(null);
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [history, setHistory] = useState<SystemUpdate[]>([]);
  const [loading, setLoading] = useState(false);
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadHistory = async () => {
    const { data } = await supabase
      .from("system_updates")
      .select("id, status, version, message, created_at")
      .order("created_at", { ascending: false })
      .limit(10);
    if (data) setHistory(data as SystemUpdate[]);
  };

  useEffect(() => {
    loadHistory();
  }, []);

  // Realtime subscription on the current pending update
  useEffect(() => {
    if (!updateId) return;
    const channel = supabase
      .channel(`system_updates:${updateId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "system_updates",
          filter: `id=eq.${updateId}`,
        },
        (payload) => {
          const next = payload.new as SystemUpdate;
          setStatus(next.status);
          if (next.status === "success") {
            toast.success("Sistema atualizado com sucesso! Recarregando...");
            reloadTimer.current = setTimeout(() => window.location.reload(), 5000);
          } else if (next.status === "failed") {
            toast.error(next.message || "Falha ao aplicar atualização na VPS");
            setLoading(false);
            setUpdateId(null);
          }
          loadHistory();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [updateId]);

  useEffect(() => {
    return () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
    };
  }, []);

  const handleUpdate = async () => {
    if (!user) return;
    setLoading(true);
    setStatus("pending");
    const { data, error } = await supabase
      .from("system_updates")
      .insert({
        status: "pending",
        version: CURRENT_VERSION,
        requested_by: user.id,
      })
      .select("id")
      .single();

    if (error || !data) {
      console.error("system_updates insert error:", error);
      toast.error(
        error?.message
          ? `Não foi possível solicitar a atualização: ${error.message}`
          : "Não foi possível solicitar a atualização",
      );
      setLoading(false);
      setStatus(null);
      return;
    }
    setUpdateId(data.id);
    toast.info("Solicitação enviada à VPS");
    loadHistory();
  };

  const buttonLabel = () => {
    if (status === "pending") return "Aguardando resposta da VPS...";
    if (status === "processing") return "Aplicando atualizações na VPS...";
    if (status === "success") return "Recarregando...";
    return "Verificar e Atualizar Sistema";
  };

  const statusBadge = (s: UpdateStatus) => {
    const map: Record<UpdateStatus, { label: string; cls: string }> = {
      pending: { label: "Pendente", cls: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400" },
      processing: { label: "Processando", cls: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
      success: { label: "Sucesso", cls: "bg-green-500/15 text-green-700 dark:text-green-400" },
      failed: { label: "Falhou", cls: "bg-red-500/15 text-red-700 dark:text-red-400" },
    };
    return <Badge variant="outline" className={map[s].cls}>{map[s].label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Gerenciamento do Sistema</h3>
            </div>
            <p className="text-sm text-muted-foreground max-w-xl">
              Sincroniza a VPS com a última versão do repositório no GitHub
              (axis-docs). A VPS escuta as solicitações e aplica as atualizações
              automaticamente.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <Badge variant="secondary" className="gap-1">
                <GitBranch className="h-3 w-3" />
                Versão Atual: {CURRENT_VERSION}
              </Badge>
              {status && statusBadge(status)}
            </div>
          </div>
          <Button
            size="lg"
            onClick={handleUpdate}
            disabled={loading}
            className="min-w-[280px]"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {buttonLabel()}
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h4 className="font-semibold mb-4">Histórico de Atualizações</h4>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma atualização registrada.</p>
        ) : (
          <div className="space-y-2">
            {history.map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between border rounded-md px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-3">
                  {statusBadge(h.status)}
                  <span className="font-mono text-xs text-muted-foreground">
                    {h.version || "—"}
                  </span>
                  {h.message && (
                    <span className="text-muted-foreground truncate max-w-md">
                      {h.message}
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(h.created_at).toLocaleString("pt-BR")}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
