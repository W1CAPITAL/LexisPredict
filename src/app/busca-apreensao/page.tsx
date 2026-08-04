/**
 * Fila BA — cliente + advogado/OAB no mesmo card; logs sem lista de terceiros.
 */
"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldAlert,
  Play,
  Pause,
  Square,
  ExternalLink,
  User,
  Briefcase,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MotorSelector } from "@/components/ai/motor-selector";
import { loadPreferredMotor, type MotorId } from "@/lib/ai/motors";
import {
  listBaQueueAction,
  scanOneClienteBaAction,
  listBaScanLogsAction,
  type BaHit,
  type BaQueueItem,
} from "@/app/actions/busca-apreensao-actions";

type Status = "idle" | "running" | "paused" | "done";

const DELAY_MS = 2800;
const DELAY_ON_429_MS = 45000;

function sleep(ms: number, signal: { cancelled: boolean }) {
  return new Promise<void>((resolve) => {
    const t = setTimeout(() => resolve(), ms);
    const iv = setInterval(() => {
      if (signal.cancelled) {
        clearTimeout(t);
        clearInterval(iv);
        resolve();
      }
    }, 200);
    setTimeout(() => clearInterval(iv), ms + 50);
  });
}

export default function BuscaApreensaoPage() {
  const { toast } = useToast();
  const [queue, setQueue] = useState<BaQueueItem[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [index, setIndex] = useState(0);
  const [hits, setHits] = useState<BaHit[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [savedLogs, setSavedLogs] = useState<any[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [current, setCurrent] = useState<BaQueueItem | null>(null);
  const [preferredMotor, setPreferredMotor] = useState<MotorId>("claude");

  useEffect(() => {
    setPreferredMotor(loadPreferredMotor());
  }, []);

  const statusRef = useRef<Status>("idle");
  const indexRef = useRef(0);
  const queueRef = useRef<BaQueueItem[]>([]);
  const cancelRef = useRef({ cancelled: false });

  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  useEffect(() => {
    indexRef.current = index;
  }, [index]);
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  const loadSaved = useCallback(async () => {
    const res = await listBaScanLogsAction(40);
    if (res.success) setSavedLogs(res.logs);
  }, []);

  const loadQueue = useCallback(async () => {
    setLoadingQueue(true);
    try {
      const res = await listBaQueueAction();
      if (res.success) {
        setQueue(res.queue);
        queueRef.current = res.queue;
      } else {
        toast({ title: "Fila", description: res.error, variant: "destructive" });
      }
      await loadSaved();
    } finally {
      setLoadingQueue(false);
    }
  }, [toast, loadSaved]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const addLog = (line: string) => {
    setLogs((prev) => [line, ...prev].slice(0, 60));
  };

  const runLoop = async (fromIndex: number) => {
    cancelRef.current.cancelled = false;
    const q = queueRef.current;
    let i = fromIndex;

    while (i < q.length) {
      if (cancelRef.current.cancelled || statusRef.current === "paused") {
        setStatus("paused");
        statusRef.current = "paused";
        return;
      }

      const item = q[i];
      setIndex(i);
      indexRef.current = i;
      setCurrent(item);

      const labelAdv = item.advogadoNome
        ? ` · Adv: ${item.advogadoNome}${item.advogadoOab ? ` (OAB ${item.advogadoOab})` : ""}`
        : "";
      addLog(`${item.nome}${labelAdv}`);

      const res = await scanOneClienteBaAction(item.nome, {
        advogadoNome: item.advogadoNome,
        advogadoOab: item.advogadoOab,
        protocolos: item.protocolos,
        createdBy: item.createdBy,
        preferredMotor,
      });

      const engLabel = (res as any).engineUsed || preferredMotor || '—';
      addLog(`[IA: ${engLabel}] Cliente: ${item.nome}`);
      if ((res as any).iaNote) {
        addLog(String((res as any).iaNote));
      }

      if (res.isRateLimited) {
        addLog(`429 — pausa ${DELAY_ON_429_MS / 1000}s (mesmo cliente)`);
        await sleep(DELAY_ON_429_MS, cancelRef.current);
        if (cancelRef.current.cancelled) {
          setStatus("paused");
          return;
        }
        continue;
      }

      if (!res.success) {
        addLog(`Erro: ${res.error || "falha"}`);
      } else {
        const n = res.hits?.length || 0;
        addLog(
          n > 0
            ? `BA: ${n} pub · ${item.nome}`
            : `Sem BA · ${item.nome} (${res.pubs ?? 0} pubs)`
        );
        if (n > 0) {
          setHits((prev) => {
            const ids = new Set(prev.map((h) => h.id));
            const extra = (res.hits || []).filter((h) => !ids.has(h.id));
            return [...extra, ...prev];
          });
        }
      }

      i += 1;
      setIndex(i);
      indexRef.current = i;

      if (i < q.length && !cancelRef.current.cancelled) {
        await sleep(DELAY_MS, cancelRef.current);
      }
    }

    setStatus("done");
    statusRef.current = "done";
    setCurrent(null);
    addLog("Fila concluída.");
    await loadSaved();
    toast({ title: "Fila BA concluída" });
  };

  const start = async () => {
    if (!queueRef.current.length) await loadQueue();
    if (!queueRef.current.length) {
      toast({ title: "Fila vazia" });
      return;
    }
    setStatus("running");
    statusRef.current = "running";
    setHits([]);
    setLogs([]);
    setIndex(0);
    await runLoop(0);
  };

  const resume = async () => {
    setStatus("running");
    statusRef.current = "running";
    await runLoop(indexRef.current);
  };

  const pause = () => {
    cancelRef.current.cancelled = true;
    setStatus("paused");
    statusRef.current = "paused";
  };

  const stop = () => {
    cancelRef.current.cancelled = true;
    setStatus("idle");
    statusRef.current = "idle";
    setCurrent(null);
  };

  const total = queue.length;
  const done = Math.min(index, total);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="flex h-screen bg-transparent font-sans text-foreground overflow-hidden relative z-10">
      <Sidebar />
      <main className="flex-1 flex flex-col h-screen overflow-hidden glass-panel">
        <header className="border-b border-border/50 bg-card/60 backdrop-blur-xl p-4 sm:px-8 shrink-0 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-red-600/10 border-2 border-red-600 flex items-center justify-center">
              <ShieldAlert className="text-red-600" size={20} />
            </div>
            <div>
              <h1 className="text-sm font-black uppercase tracking-widest">Busca e Apreensão</h1>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide">
                Cliente + CNJ da carteira · advogado só reforço DJEN · logs SQL
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <MotorSelector
              value={preferredMotor}
              onChange={(id) => setPreferredMotor(id)}
              compact
            />
            {(status === "idle" || status === "done") && (
              <Button onClick={start} disabled={loadingQueue} className="h-10 rounded-xl font-black uppercase text-[10px] bg-red-600 hover:bg-red-700 text-white">
                <Play className="mr-2 h-4 w-4" /> Iniciar fila
              </Button>
            )}
            {status === "running" && (
              <Button onClick={pause} variant="outline" className="h-10 rounded-xl font-black uppercase text-[10px]">
                <Pause className="mr-2 h-4 w-4" /> Pausar
              </Button>
            )}
            {status === "paused" && (
              <>
                <Button onClick={resume} className="h-10 rounded-xl font-black uppercase text-[10px] bg-red-600 text-white">
                  <Play className="mr-2 h-4 w-4" /> Continuar
                </Button>
                <Button onClick={stop} variant="outline" className="h-10 rounded-xl font-black uppercase text-[10px]">
                  <Square className="mr-2 h-4 w-4" /> Parar
                </Button>
              </>
            )}
          </div>
        </header>

        <div className="px-4 sm:px-8 py-4 border-b border-border/40 space-y-2 shrink-0">
          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest gap-2 flex-wrap">
            <span className="truncate">
              {current
                ? `${current.nome}${current.advogadoNome ? ` · ${current.advogadoNome}` : ""}${current.advogadoOab ? ` · OAB ${current.advogadoOab}` : ""}`
                : loadingQueue
                  ? "Carregando…"
                  : `${total} clientes`}
            </span>
            <span>
              {done}/{total || 0} ({pct}%)
            </span>
          </div>
          <Progress value={pct} className="h-2" />
        </div>

        <div className="flex-1 overflow-auto p-4 sm:p-8 grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 space-y-3">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Alertas BA ({hits.length})
            </h2>
            {hits.map((h) => (
              <div key={h.id} className="border-2 border-red-600 rounded-xl p-4 bg-card/50 space-y-2 shadow-[3px_3px_0_#dc2626]">
                <div className="flex flex-wrap justify-between gap-2">
                  <div className="space-y-1">
                    <Badge className="bg-red-600 text-white font-black uppercase text-[8px]">{h.motivoBa}</Badge>
                    <p className="font-black text-sm uppercase flex flex-wrap items-center gap-2">
                      <User size={14} /> {h.clienteNome}
                      {h.advogadoNome && (
                        <span className="font-bold text-muted-foreground normal-case text-xs">
                          · <Briefcase size={12} className="inline" /> {h.advogadoNome}
                          {h.advogadoOab ? ` · OAB ${h.advogadoOab}` : ""}
                        </span>
                      )}
                    </p>
                    <p className="font-mono text-xs font-bold">
                      Carteira: {h.protocoloCarteira || "—"}
                    </p>
                    <p className="font-mono text-xs font-bold text-muted-foreground">
                      DJEN BA: {h.processoDjen || "—"}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase">
                      {h.data || "—"} · {h.tribunal || ""}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {(h.protocoloCarteira || h.processoDjen) && (
                      <Button asChild variant="outline" size="sm" className="rounded-xl text-[8px] font-black uppercase h-8">
                        <Link href={`/cases?search=${encodeURIComponent(h.protocoloCarteira || h.processoDjen || '')}`}>Processo</Link>
                      </Button>
                    )}
                    {h.link && (
                      <Button asChild variant="outline" size="sm" className="rounded-xl h-8">
                        <a href={h.link} target="_blank" rel="noreferrer"><ExternalLink size={12} /></a>
                      </Button>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-4 whitespace-pre-wrap">{h.trecho}</p>
              </div>
            ))}
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div>
              <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                Log da sessão
              </h2>
              <div className="border-2 border-border rounded-xl p-3 max-h-[28vh] overflow-auto bg-secondary/20 font-mono text-[10px] space-y-1">
                {logs.map((l, i) => (
                  <div key={i} className="border-b border-border/30 pb-1">{l}</div>
                ))}
              </div>
            </div>
            <div>
              <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1">
                <History size={12} /> Salvos (SQL · seu usuário)
              </h2>
              <div className="border-2 border-border rounded-xl p-3 max-h-[32vh] overflow-auto text-[10px] space-y-2">
                {savedLogs.length === 0 && (
                  <p className="text-muted-foreground font-bold uppercase">
                    Nenhum log salvo — rode o SQL se a tabela não existir
                  </p>
                )}
                {savedLogs.filter((row) => row.motivo_ba && row.motivo_ba !== 'CONSULTA_SEM_BA' && row.motivo_ba !== 'scan_tick').map((row) => (
                  <div key={row.id} className="border-b border-border/40 pb-2">
                    <p className="font-black uppercase">
                      {row.cliente_nome}
                      {row.advogado_nome ? ` · ${row.advogado_nome}` : ""}
                      {row.advogado_oab ? ` · OAB ${row.advogado_oab}` : ""}
                    </p>
                    <p className="text-muted-foreground font-bold">
                      {row.motivo_ba} · {row.data_publicacao || row.created_at?.slice?.(0, 10) || ""}
                    </p>
                    <p className="font-mono">
                      Carteira: {row.protocolo_ref || "—"} · DJEN: {row.processo_djen || "—"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
