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
import { Archive, Bot, List, X, Loader2, Building2 } from "lucide-react";
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
  } | null>(null);
  const [pendentes, setPendentes] = useState<{
    limpa: number;
    revisao: number;
    total: number;
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
        limpa: r.baixaLimpaPendentes,
        revisao: r.revisaoPendentes,
        total: r.totalPendentes,
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
    let scanned = 0;
    let auto = 0;
    let revisao = 0;
    let failed = 0;
    let skipped = 0;
    let pages = 0;
    const maxPages = 300;
    let lastPct = 0;

    const initial = await countAutoEncerrarPendentesAction();
    const totalMeta = initial.success ? initial.totalPendentes : pendentes?.total || 0;

    toast({
      title: "Auto-encerrar · só baixas claras",
      description:
        "Não mexe em processo saudável. Só baixa tribunal limpa → arquiva; residual → revisar.",
    });

    try {
      while (!stopRef.current && pages < maxPages) {
        const res = await runAutoEncerrarBatchAction({
          limit: 40,
          offset,
          soBaixaTribunal: true,
          marcarRevisao: true,
        });
        pages++;
        if (!res.success) {
          setLastRun(res.error || "Erro no lote");
          toast({
            title: "Erro no lote",
            description: res.error || "Falha",
            variant: "destructive",
          });
          break;
        }
        scanned += res.scanned;
        auto += res.autoEncerrados;
        revisao += res.revisao;
        failed += res.failed;
        skipped += res.skipped || 0;
        offset = res.nextOffset;

        // %: combina offset na lista + meta de pendentes
        const byOffset = res.percentDone;
        const byWork =
          totalMeta > 0
            ? Math.min(99, Math.round(((auto + revisao) / totalMeta) * 100))
            : byOffset;
        const percentDone = Math.max(byOffset, byWork, lastPct);
        lastPct = percentDone;
        const percentLeft = Math.max(0, 100 - percentDone);

        setProgress({
          scanned,
          auto,
          revisao,
          failed,
          skipped,
          percentDone,
          percentLeft,
          total: totalMeta || res.totalCandidates,
        });

        if (res.scanned === 0 && !res.hasMore) break;
        if (!res.hasMore) break;
        await new Promise((r) => setTimeout(r, 200));
      }

      // 100% ao terminar
      setProgress((p) =>
        p
          ? { ...p, percentDone: 100, percentLeft: 0 }
          : {
              scanned,
              auto,
              revisao,
              failed,
              skipped,
              percentDone: 100,
              percentLeft: 0,
              total: totalMeta,
            }
      );

      const msg = `Escaneados ${scanned} · auto ${auto} · revisar ${revisao} · pulados ${skipped} · falhas ${failed}`;
      setLastRun(msg);
      toast({ title: "Lote concluído", description: msg });
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
          <Bot className="h-4 w-4 text-primary shrink-0" />
          <div className="min-w-0">
            <span className="text-[10px] font-black uppercase tracking-widest block">
              Encerrados · scanner W1 CONTROL
            </span>
            {isW1 && (
              <span className="text-[9px] text-muted-foreground font-medium">
                Davi Alves Figueredo · empresa principal W1
              </span>
            )}
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
            {running ? "Rodando…" : "Rodar empresa toda"}
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
          Candidatos:{" "}
          <span className="text-primary tabular-nums">{pendentes.limpa}</span> baixa limpa
          (auto) ·{" "}
          <span className="tabular-nums text-amber-600 dark:text-amber-400">
            {pendentes.revisao}
          </span>{" "}
          residual (só revisar) · total{" "}
          <span className="tabular-nums">{pendentes.total}</span>
          <span className="block text-muted-foreground font-medium mt-0.5">
            Não processa processo sem baixa no tribunal nem carteira “saudável”.
          </span>
        </p>
      )}

      {progress && (
        <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-[10px] space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="font-black uppercase tracking-widest">Progresso</p>
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
            Auto {progress.auto} · Revisar {progress.revisao} · Pulados {progress.skipped} ·
            Falhas {progress.failed}
            {progress.total > 0 ? ` · meta ~${progress.total}` : ""}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Kpi label="Seus encerrados" value={stats.usuarioEncerrados} hint="carteira do usuário" />
        <Kpi label="Empresa encerrados" value={stats.empresaEncerrados} hint="toda a empresa" />
        <Kpi
          label="Scanner auto (semana)"
          value={stats.scannerAutoSemana}
          hint="W1 CONTROL nesta semana"
          tone="ok"
        />
        <Kpi
          label="Scanner auto (total)"
          value={stats.scannerAutoTotal}
          hint={`hoje ${stats.scannerAutoHoje}`}
          tone="ok"
        />
      </div>

      <p className="text-[10px] text-muted-foreground leading-relaxed">
        Ativos na lista: <strong className="text-foreground">{stats.empresaAtivos}</strong>
        {" · "}Baixas tribunal: {stats.empresaBaixasTribunal}.
        {lastRun && (
          <span className="block mt-1 text-foreground font-medium">Última rodada: {lastRun}</span>
        )}
      </p>

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
              className="flex items-center justify-between gap-2 border-b border-border px-4 py-3 shrink-0"
              style={{ backgroundColor: "hsl(var(--card))" }}
            >
              <div>
                <p className="text-xs font-black uppercase tracking-widest">
                  Logs de encerramento · todos
                </p>
                <p className="text-[10px] text-muted-foreground">{logs.length} registros</p>
              </div>
              <Button type="button" size="icon" variant="ghost" onClick={() => setOpenLogs(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div
              className="overflow-y-auto p-3 space-y-2 text-sm flex-1"
              style={{ backgroundColor: "hsl(var(--background))" }}
            >
              {logs.length === 0 ? (
                <p className="text-muted-foreground text-xs p-4 text-center">
                  Vazio. Use <strong>Rodar empresa toda</strong> e Atualizar.
                </p>
              ) : (
                logs.map((l, i) => (
                  <div
                    key={`${l.protocolo}-${i}`}
                    className="rounded-lg border border-border px-3 py-2 space-y-1"
                    style={{ backgroundColor: "hsl(var(--card))" }}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">
                        {l.acao === "auto_encerrar"
                          ? "AUTO W1"
                          : l.acao === "revisao_fila"
                            ? "REVISAR"
                            : l.acao === "sistema"
                              ? "SISTEMA"
                              : "HUMANO"}
                      </Badge>
                      <span className="font-mono text-[11px] font-semibold">
                        {l.protocolo || "—"}
                      </span>
                    </div>
                    <p className="text-xs font-semibold">{l.cliente || "—"}</p>
                    <p className="text-[11px] text-muted-foreground">{l.motivo}</p>
                    {l.por && (
                      <p className="text-[10px] font-bold text-primary">
                        {isW1 || l.acao === "humano" ? l.por : "W1 CONTROL"}
                      </p>
                    )}
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

function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: "ok";
}) {
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
      {hint && <p className="text-[9px] text-muted-foreground leading-tight">{hint}</p>}
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
