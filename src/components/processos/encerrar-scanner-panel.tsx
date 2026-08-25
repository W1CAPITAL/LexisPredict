"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  computeEncerrarScannerStats,
  collectScanEncerrarLogs,
} from "@/lib/encerrar-scanner-stats";
import { isEncerradoPeloScanner, getOperacaoSistemaLabel } from "@/lib/operacao-sistema";
import { isEmpresaW1Principal } from "@/lib/w1-empresa";
import {
  runAutoEncerrarBatchAction,
  countAutoEncerrarPendentesAction,
} from "@/app/actions/auto-encerrar-actions";
import { Archive, List, X, Loader2, Building2, Radar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Props = {
  cases: any[];
  authUserId?: string | null;
  empresaId?: string | null;
  visaoEmpresa?: boolean;
  onDone?: () => void;
};

export function EncerrarScannerPanel({
  cases,
  authUserId,
  empresaId,
  onDone,
}: Props) {
  const [openLogs, setOpenLogs] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{
    scanned: number;
    auto: number;
    revisao: number;
    failed: number;
    skipped: number;
    percentDone: number;
    percentLeft: number;
    total: number;
    fonte: string;
  } | null>(null);
  const [pendentes, setPendentes] = useState<{
    baixaAtivos: number;
    baixasTotal: number;
    outros: number;
  } | null>(null);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const stopRef = useRef(false);
  const { toast } = useToast();
  const isW1 = isEmpresaW1Principal(empresaId);

  const stats = useMemo(
    () => computeEncerrarScannerStats(cases, { authUserId }),
    [cases, authUserId]
  );
  const logs = useMemo(() => collectScanEncerrarLogs(cases, 400), [cases]);

  const refreshCount = async () => {
    const r = await countAutoEncerrarPendentesAction();
    if (r.success) {
      setPendentes({
        baixaAtivos: r.baixaAtivos,
        baixasTotal: r.baixasTribunalTotal,
        outros: r.outrosAtivos,
      });
    }
  };

  useEffect(() => {
    void refreshCount();
  }, [cases.length]);

  const runEmpresaToda = async () => {
    if (running) return;
    setRunning(true);
    stopRef.current = false;

    let offset = 0;
    let afterId: number | null = null;
    let scanned = 0;
    let auto = 0;
    let revisao = 0;
    let failed = 0;
    let skipped = 0;
    let pages = 0;
    const maxPages = 500;
    const allSamples: string[] = [];
    let lastPct = 0;
    let lastFonte = "db+datajud+djen";

    const initial = await countAutoEncerrarPendentesAction();
    const totalMeta = initial.success ? initial.baixaAtivos : pendentes?.baixaAtivos || 0;

    toast({
      title: "Scanner de encerramento completo",
      description: `Banco + DataJud + DJEN + motores auto/revisar · ~${totalMeta} ativos com baixa. Não feche a aba.`,
    });

    try {
      while (!stopRef.current && pages < maxPages) {
        // fase full: tenta DB primeiro; se não decidir, tribunal no mesmo item
        const batch = await runAutoEncerrarBatchAction({
          limit: 40,
          offset,
          afterId,
          soBaixaTribunal: true,
          fase: "full",
          fast: true,
        });
        pages++;

        if (!batch || !batch.success) {
          const errMsg = batch?.error || "Erro no lote";
          setLastRun(errMsg);
          toast({
            title: "Erro no lote",
            description: errMsg,
            variant: "destructive",
          });
          break;
        }

        scanned += batch.scanned || 0;
        auto += batch.autoEncerrados || 0;
        revisao += batch.revisao || 0;
        failed += batch.failed || 0;
        skipped += batch.skipped || 0;
        offset = batch.nextOffset ?? offset + 1;
        if (batch.afterId != null) afterId = batch.afterId;
        lastFonte = batch.fonte || lastFonte;
        if (batch.samples?.length) allSamples.push(...batch.samples.slice(0, 12));
        if (batch.lastError) console.warn("[encerrar-scan]", batch.lastError);

        const workPct =
          totalMeta > 0
            ? Math.min(
                99,
                Math.round(((auto + revisao + Math.max(0, scanned - auto - revisao)) / totalMeta) * 100)
              )
            : batch.percentDone;
        const percentDone = Math.max(lastPct, workPct, Math.min(99, batch.percentDone));
        lastPct = percentDone;

        setProgress({
          scanned,
          auto,
          revisao,
          failed,
          skipped,
          percentDone: batch.hasMore ? percentDone : 100,
          percentLeft: batch.hasMore ? Math.max(0, 100 - percentDone) : 0,
          total: totalMeta || batch.totalCandidates,
          fonte: lastFonte,
        });

        if ((batch.scanned || 0) === 0 && !batch.hasMore) break;
        if (!batch.hasMore) break;
        // sem avanço de cursor = fim
        if (batch.afterId == null) break;
        await new Promise((r) => setTimeout(r, 200));
      }

      setProgress((p) => (p ? { ...p, percentDone: 100, percentLeft: 0 } : p));

      const msg =
        `Auto ${auto} · Revisar ${revisao} · Falhas ${failed} · Escaneados ${scanned}` +
        (allSamples.length ? ` · ${allSamples.slice(0, 6).join(" | ")}` : "");
      setLastRun(msg);
      toast({
        title: auto > 0 ? `${auto} auto-encerrados` : "Lote concluído",
        description: msg,
        variant: auto > 0 ? "default" : undefined,
      });
      await refreshCount();
      onDone?.();
    } catch (e: any) {
      toast({
        title: "Erro",
        description: e?.message || String(e),
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card text-card-foreground p-3 space-y-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Radar className="h-4 w-4 text-primary shrink-0" />
          <div className="min-w-0">
            <span className="text-[10px] font-black uppercase tracking-widest block">
              Scanner de encerramento · multi-motor
            </span>
            <span className="text-[9px] text-muted-foreground font-medium">
              Dados salvos + DataJud/DJEN → só baixas/arquivados no tribunal → auto / revisar
              {isW1 ? " · W1 CONTROL / Davi Alves Figueredo" : " · W1 CONTROL"}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {running && (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="h-8 text-[10px] font-black uppercase tracking-widest"
              onClick={() => {
                stopRef.current = true;
              }}
            >
              Parar
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            className="h-8 text-[10px] font-black uppercase tracking-widest"
            disabled={running}
            onClick={() => void runEmpresaToda()}
          >
            {running ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <Building2 className="h-3.5 w-3.5 mr-1" />
            )}
            {running ? "Escaneando…" : "Rodar empresa (completo)"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 text-[10px] font-black uppercase tracking-widest"
            onClick={() => setOpenLogs(true)}
          >
            <List className="h-3.5 w-3.5 mr-1" />
            Ver logs
          </Button>
        </div>
      </div>

      {pendentes != null && (
        <p className="text-[10px] font-semibold text-foreground leading-relaxed">
          Baixas tribunal: <span className="tabular-nums">{pendentes.baixasTotal}</span>
          {" · "}ativos com baixa:{" "}
          <span className="tabular-nums text-primary">{pendentes.baixaAtivos}</span>
          {" · "}outros ativos: {pendentes.outros}
          <span className="block text-muted-foreground font-medium mt-0.5">
            Lote de 40 por rodada (sem teto de 8 no DJEN). Cada caso: dados salvos → se precisar,
            tribunal completo → motor auto ou revisar.
          </span>
        </p>
      )}

      {progress && (
        <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-[10px] space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="font-black uppercase tracking-widest">Progresso · {progress.fonte}</p>
            <p className="tabular-nums font-black text-sm text-primary">
              {progress.percentDone}%
              <span className="text-muted-foreground font-semibold text-[10px] ml-1">
                · falta {progress.percentLeft}%
              </span>
            </p>
          </div>
          <div className="h-2 rounded-full bg-border overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${Math.min(100, progress.percentDone)}%` }}
            />
          </div>
          <p className="tabular-nums text-foreground">
            Auto{" "}
            <strong className="text-emerald-600 dark:text-emerald-400">{progress.auto}</strong>
            {" · "}Revisar {progress.revisao} · Falhas {progress.failed} · Escaneados{" "}
            {progress.scanned}
            {progress.total > 0 ? ` / meta ~${progress.total}` : ""}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Kpi label="Seus encerrados" value={stats.usuarioEncerrados} />
        <Kpi label="Empresa encerrados" value={stats.empresaEncerrados} />
        <Kpi label="Scanner auto (semana)" value={stats.scannerAutoSemana} tone="ok" />
        <Kpi label="Scanner auto (total)" value={stats.scannerAutoTotal} tone="ok" />
      </div>

      {lastRun && (
        <p className="text-[10px] text-foreground font-medium">Última: {lastRun}</p>
      )}

      {openLogs && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-3"
          style={{ backgroundColor: "rgba(0,0,0,0.72)" }}
          onClick={() => setOpenLogs(false)}
        >
          <div
            className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl border border-border shadow-2xl flex flex-col"
            style={{
              backgroundColor: "hsl(var(--background))",
              color: "hsl(var(--foreground))",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between gap-2 border-b border-border px-4 py-3"
              style={{ backgroundColor: "hsl(var(--card))" }}
            >
              <p className="text-xs font-black uppercase tracking-widest">
                Logs · {logs.length}
              </p>
              <Button type="button" size="icon" variant="ghost" onClick={() => setOpenLogs(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="overflow-y-auto p-3 space-y-2 text-sm flex-1">
              {logs.length === 0 ? (
                <p className="text-muted-foreground text-xs p-4 text-center">
                  Rode o scanner e Atualizar.
                </p>
              ) : (
                logs.map((l, i) => (
                  <div
                    key={`${l.protocolo}-${i}`}
                    className="rounded-lg border border-border px-3 py-2"
                    style={{ backgroundColor: "hsl(var(--card))" }}
                  >
                    <Badge variant="outline">
                      {l.acao === "auto_encerrar"
                        ? "AUTO W1"
                        : l.acao === "revisao_fila"
                          ? "REVISAR"
                          : "HUMANO"}
                    </Badge>{" "}
                    <span className="font-mono text-[11px] font-semibold">{l.protocolo}</span>
                    <p className="text-[11px] text-muted-foreground mt-1">{l.motivo}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone?: "ok" }) {
  return (
    <div
      className={
        "rounded-lg border px-2.5 py-2 " +
        (tone === "ok" ? "border-emerald-500/40 bg-emerald-500/10" : "border-border bg-muted/30")
      }
    >
      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="text-lg font-black tabular-nums text-foreground">{value}</p>
    </div>
  );
}

export function BadgeEncerradoScanner({
  caseData,
  empresaId,
}: {
  caseData: any;
  empresaId?: string | null;
}) {
  if (!isEncerradoPeloScanner(caseData)) return null;
  const legenda = getOperacaoSistemaLabel(caseData, empresaId);
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-600/50 bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
      <Archive className="h-3 w-3" />
      Scanner W1
      {legenda ? (
        <span className="font-medium normal-case tracking-normal opacity-80">· {legenda}</span>
      ) : null}
    </span>
  );
}
