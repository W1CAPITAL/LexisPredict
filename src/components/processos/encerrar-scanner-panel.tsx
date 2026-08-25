"use client";

import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  computeEncerrarScannerStats,
  collectScanEncerrarLogs,
} from "@/lib/encerrar-scanner-stats";
import { isEncerradoPeloScanner, getOperacaoSistemaLabel } from "@/lib/operacao-sistema";
import { Archive, Bot, List, X } from "lucide-react";

type Props = {
  cases: any[];
  authUserId?: string | null;
  visaoEmpresa?: boolean;
};

export function EncerrarScannerPanel({ cases, authUserId, visaoEmpresa = true }: Props) {
  const [openLogs, setOpenLogs] = useState(false);
  const stats = useMemo(
    () => computeEncerrarScannerStats(cases, { authUserId }),
    [cases, authUserId]
  );
  const logs = useMemo(() => collectScanEncerrarLogs(cases, 300), [cases]);

  return (
    <div className="rounded-xl border border-border/60 bg-card/80 p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          <span className="text-[10px] font-black uppercase tracking-widest">
            Encerrados · scanner W1 CONTROL
          </span>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 text-[10px] font-black uppercase tracking-widest"
          onClick={() => setOpenLogs(true)}
        >
          <List className="h-3.5 w-3.5 mr-1" />
          Ver logs completos
        </Button>
      </div>

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
          hint={`hoje ${stats.scannerAutoHoje} · revisar ${stats.revisaoPendente}`}
          tone="ok"
        />
      </div>

      <p className="text-[10px] text-muted-foreground leading-relaxed">
        Auto-encerrar conta para <strong>W1 CONTROL</strong>
        {" "}(Davi Alves Figueredo · scanner), não como atendimento de operador.
        Baixas tribunal: {stats.empresaBaixasTribunal}. Ativos empresa: {stats.empresaAtivos}.
      </p>

      {openLogs && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 p-3">
          <div className="w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-2xl border bg-background shadow-xl flex flex-col">
            <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
              <div>
                <p className="text-xs font-black uppercase tracking-widest">
                  Logs de encerramento · todos
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {logs.length} registros · scanner e revisão
                </p>
              </div>
              <Button type="button" size="icon" variant="ghost" onClick={() => setOpenLogs(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="overflow-y-auto p-3 space-y-2 text-sm">
              {logs.length === 0 ? (
                <p className="text-muted-foreground text-xs p-4 text-center">
                  Ainda sem auto-encerrar nesta carteira carregada. Rode o scanner (BOTH) e
                  aguarde processos com baixa + improcedente.
                </p>
              ) : (
                logs.map((l, i) => (
                  <div
                    key={`${l.protocolo}-${i}`}
                    className="rounded-lg border px-3 py-2 space-y-1"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={
                          l.acao === "auto_encerrar"
                            ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                            : "border-amber-500/40 text-amber-700 dark:text-amber-400"
                        }
                      >
                        {l.acao === "auto_encerrar" ? "AUTO W1" : "REVISAR"}
                      </Badge>
                      <span className="font-mono text-[11px]">{l.protocolo || "—"}</span>
                      {l.dia && (
                        <span className="text-[10px] text-muted-foreground">{l.dia}</span>
                      )}
                    </div>
                    <p className="text-xs font-medium">{l.cliente || "—"}</p>
                    <p className="text-[11px] text-muted-foreground">{l.motivo}</p>
                    {l.acao === "auto_encerrar" && (
                      <p className="text-[10px] font-bold text-primary">
                        W1 CONTROL · Feito por Davi Alves Figueredo · scanner automático
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
        (tone === "ok" ? "border-emerald-500/30 bg-emerald-500/5" : "border-border/50")
      }
    >
      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="text-lg font-black tabular-nums">{value}</p>
      {hint && <p className="text-[9px] text-muted-foreground leading-tight">{hint}</p>}
    </div>
  );
}

export function BadgeEncerradoScanner({ caseData }: { caseData: any }) {
  if (!isEncerradoPeloScanner(caseData)) return null;
  const legenda = getOperacaoSistemaLabel(caseData);
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
      <Archive className="h-3 w-3" />
      Scanner W1
      {legenda ? (
        <span className="font-medium normal-case tracking-normal opacity-80">· {legenda}</span>
      ) : null}
    </span>
  );
}
