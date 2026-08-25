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

export function EncerrarScannerPanel({ cases, authUserId }: Props) {
  const [openLogs, setOpenLogs] = useState(false);
  const stats = useMemo(
    () => computeEncerrarScannerStats(cases, { authUserId }),
    [cases, authUserId]
  );
  const logs = useMemo(() => collectScanEncerrarLogs(cases, 400), [cases]);

  return (
    <div className="rounded-xl border border-border bg-card text-card-foreground p-3 space-y-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary shrink-0" />
          <span className="text-[10px] font-black uppercase tracking-widest">
            Encerrados · scanner W1 CONTROL
          </span>
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
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
          hint={`hoje ${stats.scannerAutoHoje} · humano ${stats.humanoEncerrados} · revisar ${stats.revisaoPendente}`}
          tone="ok"
        />
      </div>

      <p className="text-[10px] text-muted-foreground leading-relaxed">
        Auto-encerrar = <strong className="text-foreground">W1 CONTROL</strong> (Davi Alves
        Figueredo · scanner), não atendimento de operador. Ativos na lista:{" "}
        <strong className="text-foreground">{stats.empresaAtivos}</strong>
        {" · "}Baixas tribunal: {stats.empresaBaixasTribunal}.
        {stats.scannerAutoTotal === 0 && (
          <>
            {" "}
            <span className="text-amber-700 dark:text-amber-400 font-semibold">
              Ainda 0 auto-scanner: rode Scanner BOTH de novo após este deploy (baixa limpa sem
              procedente/CS).
            </span>
          </>
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
            style={{ backgroundColor: "hsl(var(--background))", color: "hsl(var(--foreground))" }}
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
                <p className="text-[10px] text-muted-foreground">
                  {logs.length} registros · auto W1, revisão e humanos
                </p>
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
                  Nenhum processo encerrado na carteira carregada nesta tela.
                </p>
              ) : (
                logs.map((l, i) => (
                  <div
                    key={`${l.protocolo}-${i}`}
                    className="rounded-lg border border-border px-3 py-2 space-y-1"
                    style={{ backgroundColor: "hsl(var(--card))" }}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={
                          l.acao === "auto_encerrar"
                            ? "border-emerald-600 text-emerald-800 dark:text-emerald-300"
                            : l.acao === "revisao_fila"
                              ? "border-amber-600 text-amber-800 dark:text-amber-300"
                              : "border-border text-foreground"
                        }
                      >
                        {l.acao === "auto_encerrar"
                          ? "AUTO W1"
                          : l.acao === "revisao_fila"
                            ? "REVISAR"
                            : l.acao === "sistema"
                              ? "SISTEMA"
                              : "HUMANO"}
                      </Badge>
                      <span className="font-mono text-[11px] font-semibold">{l.protocolo || "—"}</span>
                      {l.dia && (
                        <span className="text-[10px] text-muted-foreground">{l.dia}</span>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-foreground">{l.cliente || "—"}</p>
                    <p className="text-[11px] text-muted-foreground">{l.motivo}</p>
                    {l.por && (
                      <p className="text-[10px] font-bold text-primary">{l.por}</p>
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
      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-lg font-black tabular-nums text-foreground">{value}</p>
      {hint && <p className="text-[9px] text-muted-foreground leading-tight">{hint}</p>}
    </div>
  );
}

export function BadgeEncerradoScanner({ caseData }: { caseData: any }) {
  if (!isEncerradoPeloScanner(caseData)) return null;
  const legenda = getOperacaoSistemaLabel(caseData);
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
