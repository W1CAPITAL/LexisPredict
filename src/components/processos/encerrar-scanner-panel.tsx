"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  runAutoEncerrarBatchAction,
  countAutoEncerrarPendentesAction,
  resetViaScanFlagsBaixasAction,
} from "@/app/actions/auto-encerrar-actions";
import { Loader2, Play, List, RotateCcw } from "lucide-react";

type Props = {
  cases?: any[];
  authUserId?: string | null;
  empresaId?: string | null;
  visaoEmpresa?: boolean;
  /** Se false, oculta botão "Rodar empresa" (só Supervisão/Superadmin). */
  canRodarEmpresa?: boolean;
  onDone?: () => void;
};

export function EncerrarScannerPanel({ onDone, canRodarEmpresa = true }: Props) {
  const [running, setRunning] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [pendentes, setPendentes] = useState<{
    baixaAtivos: number;
    baixasTotal: number;
    bloqueadosViaScan: number;
  } | null>(null);
  const [logsOpen, setLogsOpen] = useState(false);

  const refreshCount = useCallback(async () => {
    try {
      const r = await countAutoEncerrarPendentesAction();
      if (r.success) {
        setPendentes({
          baixaAtivos: r.baixaAtivos,
          baixasTotal: r.baixasTribunalTotal,
          bloqueadosViaScan: (r as any).bloqueadosViaScan || 0,
        });
      }
    } catch {
      /* */
    }
  }, []);

  useEffect(() => {
    void refreshCount();
  }, [refreshCount]);

  const resetFlags = async () => {
    if (!canRodarEmpresa) {
      toast({ title: "Sem permissão", description: "Só Supervisão/Superadmin pode reabrir a fila.", variant: "destructive" });
      return;
    }
    if (resetting) return;
    setResetting(true);
    try {
      const r = await resetViaScanFlagsBaixasAction();
      if (r.success) {
        toast({
          title: "Fila reaberta",
          description: `${r.updated} liberados para scan real.`,
        });
        await refreshCount();
      } else {
        toast({ title: "Erro", description: r.error, variant: "destructive" });
      }
    } finally {
      setResetting(false);
    }
  };

  const runEmpresaToda = async () => {
    if (!canRodarEmpresa) {
      toast({ title: "Sem permissão", description: "Só Supervisão/Superadmin pode rodar a empresa.", variant: "destructive" });
      return;
    }
    if (running) return;
    setRunning(true);
    setLastRun(null);

    let afterId: number | null = null;
    let auto = 0;
    let revisao = 0;
    let failed = 0;
    let scanned = 0;
    const allSamples: string[] = [];
    let loops = 0;
    const maxLoops = 80;

    try {
      const initial = await countAutoEncerrarPendentesAction();
      if (initial.success && initial.baixaAtivos === 0) {
        if ((initial as any).bloqueadosViaScan > 0) {
          toast({
            title: "Fila bloqueada",
            description: `${(initial as any).bloqueadosViaScan} com via_scan_auto. Use Reabrir fila.`,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Nenhum pendente",
            description: "Não há baixas tribunal sem via_scan_auto.",
            variant: "destructive",
          });
        }
        return;
      }

      while (loops < maxLoops) {
        loops++;
        const batch = await runAutoEncerrarBatchAction({
          limit: 5,
          afterId,
          soBaixaTribunal: true,
          fase: "full",
          fast: true,
        });

        if (!batch?.success) {
          toast({
            title: "Erro no lote",
            description: batch?.error || "Falha",
            variant: "destructive",
          });
          break;
        }

        auto += batch.autoEncerrados || 0;
        revisao += batch.revisao || 0;
        failed += batch.failed || 0;
        scanned += batch.scanned || 0;
        if (batch.samples?.length) allSamples.push(...batch.samples);
        if (batch.afterId != null) afterId = batch.afterId;

        setLastRun(
          `Auto ${auto} · Revisar ${revisao} · Falhas ${failed} · Escaneados ${scanned}` +
            (batch.debug ? ` · ${batch.debug}` : "") +
            (allSamples.length ? ` · ${allSamples.slice(-3).join(" | ")}` : "")
        );

        if ((batch.scanned || 0) === 0 && !batch.hasMore) {
          if (scanned === 0) {
            toast({
              title: "Sem candidatos neste lote",
              description: batch.debug || batch.error || "Confira Reabrir fila se houver bloqueados.",
              variant: "destructive",
            });
          }
          break;
        }
        if (!batch.hasMore && (batch.scanned || 0) < 5) break;

        await new Promise((r) => setTimeout(r, 600));
      }

      if (scanned > 0) {
        toast({
          title: auto > 0 ? `${auto} auto-encerrados` : "Lote real concluído",
          description: `Auto ${auto} · Revisar ${revisao} · Falhas ${failed} · Escaneados ${scanned}`,
        });
      }
      await refreshCount();
      onDone?.();
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">
            Scanner de encerramento · multi-motor
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Dados salvos + DataJud/DJEN real · só baixas tribunal · até 5 scans/lote
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canRodarEmpresa ? (
          <Button type="button" size="sm" disabled={running} onClick={() => void runEmpresaToda()}>
            {running ? (
              <>
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> Escaneando…
              </>
            ) : (
              <>
                <Play className="mr-1 h-3.5 w-3.5" /> Rodar empresa
              </>
            )}
          </Button>
          ) : null}
          <Button type="button" size="sm" variant="outline" onClick={() => setLogsOpen((v) => !v)}>
            <List className="mr-1 h-3.5 w-3.5" /> Ver logs
          </Button>
        </div>
      </div>

      {pendentes && (
        <p className="text-[11px] text-muted-foreground">
          Baixas tribunal (coluna):{" "}
          <span className="tabular-nums font-medium text-foreground">{pendentes.baixasTotal}</span>
          {" · "}
          Pendentes de scan:{" "}
          <span className="tabular-nums font-medium text-primary">{pendentes.baixaAtivos}</span>
          {pendentes.bloqueadosViaScan > 0 && (
            <>
              {" · "}
              Bloqueados via_scan:{" "}
              <span className="tabular-nums text-amber-700">{pendentes.bloqueadosViaScan}</span>
            </>
          )}
        </p>
      )}

      {canRodarEmpresa && pendentes && pendentes.bloqueadosViaScan > 0 && (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={resetting || running}
          onClick={() => void resetFlags()}
        >
          <RotateCcw className="mr-1 h-3.5 w-3.5" />
          {resetting ? "Reabrindo…" : `Reabrir fila (${pendentes.bloqueadosViaScan})`}
        </Button>
      )}
      {!canRodarEmpresa && pendentes && pendentes.bloqueadosViaScan > 0 && (
        <p className="text-[10px] text-muted-foreground">
          {pendentes.bloqueadosViaScan} bloqueados via_scan — apenas Supervisão pode reabrir a fila.
        </p>
      )}

      <p className="text-[10px] text-muted-foreground">
        Cada “Escaneado” = 1 chamada real ao DataJud/DJEN (leva segundos). Não inventa volume.
      </p>

      {lastRun && (
        <p className="text-[11px] font-mono text-muted-foreground break-all">Última: {lastRun}</p>
      )}
      {logsOpen && lastRun && (
        <pre className="text-[10px] bg-muted/40 p-2 rounded-md overflow-auto max-h-40">{lastRun}</pre>
      )}
    </div>
  );
}
