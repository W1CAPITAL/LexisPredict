/**
 * Fila BA por nome do cliente (1 a 1, delay anti-429)
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
  Loader2,
  Play,
  Pause,
  Square,
  ExternalLink,
  Gavel,
  User,
  Briefcase,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  listBaQueueAction,
  scanOneClienteBaAction,
  type BaHit,
  type BaQueueItem,
} from "@/app/actions/busca-apreensao-actions";

type Status = "idle" | "running" | "paused" | "done";

const DELAY_MS = 2800; // espaçamento entre clientes (anti-429)
const DELAY_ON_429_MS = 45000; // pausa longa se 429

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
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [currentName, setCurrentName] = useState<string | null>(null);

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
    } finally {
      setLoadingQueue(false);
    }
  }, [toast]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const addLog = (line: string) => {
    setLogs((prev) => [line, ...prev].slice(0, 80));
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
      setCurrentName(item.nome);
      addLog(`Consultando: ${item.nome}`);

      const res = await scanOneClienteBaAction(item.nome);

      if (res.isRateLimited) {
        addLog(`429 Rate limit — aguardando ${DELAY_ON_429_MS / 1000}s…`);
        toast({
          title: "DJEN 429",
          description: `Pausa de ${DELAY_ON_429_MS / 1000}s e retoma o mesmo cliente.`,
          variant: "destructive",
        });
        await sleep(DELAY_ON_429_MS, cancelRef.current);
        if (cancelRef.current.cancelled) {
          setStatus("paused");
          return;
        }
        // não avança índice — tenta de novo o mesmo
        continue;
      }

      if (!res.success) {
        addLog(`Erro (${item.nome}): ${res.error || "falha"}`);
      } else {
        const n = res.hits?.length || 0;
        addLog(
          n > 0
            ? `BA encontrado: ${item.nome} (${n})`
            : `OK sem BA: ${item.nome} (${res.pubs ?? 0} pubs)`
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
    setCurrentName(null);
    addLog("Fila concluída.");
    toast({ title: "Fila BA concluída" });
  };

  const start = async () => {
    if (!queue.length) {
      await loadQueue();
    }
    if (!queueRef.current.length) {
      toast({ title: "Fila vazia", description: "Nenhum cliente na carteira." });
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
    addLog("Pausado.");
  };

  const stop = () => {
    cancelRef.current.cancelled = true;
    setStatus("idle");
    statusRef.current = "idle";
    setCurrentName(null);
    addLog("Parado.");
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
              <h1 className="text-sm font-black uppercase tracking-widest">
                Busca e Apreensão
              </h1>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide">
                Fila por nome do cliente · DJEN 1 a 1 · anti-429
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {(status === "idle" || status === "done") && (
              <Button
                onClick={start}
                disabled={loadingQueue}
                className="h-10 rounded-xl font-black uppercase text-[10px] bg-red-600 hover:bg-red-700 text-white"
              >
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
            <Button asChild variant="outline" size="sm" className="h-10 rounded-xl text-[9px] font-black uppercase">
              <Link href="/cases?filter=hoje">Processos de hoje</Link>
            </Button>
          </div>
        </header>

        <div className="px-4 sm:px-8 py-4 border-b border-border/40 space-y-2 shrink-0">
          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
            <span>
              {status === "running" && currentName
                ? `Consultando: ${currentName}`
                : status === "paused"
                  ? "Pausado"
                  : status === "done"
                    ? "Concluído"
                    : loadingQueue
                      ? "Carregando fila…"
                      : `${total} clientes na fila`}
            </span>
            <span>
              {done}/{total || 0} ({pct}%)
            </span>
          </div>
          <Progress value={pct} className="h-2" />
          <p className="text-[9px] text-muted-foreground font-bold uppercase">
            Delay {DELAY_MS / 1000}s entre clientes · se 429, espera {DELAY_ON_429_MS / 1000}s e repete o mesmo nome
          </p>
        </div>

        <div className="flex-1 overflow-auto p-4 sm:p-8 grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 space-y-3">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Alertas BA ({hits.length})
            </h2>
            {hits.length === 0 && (
              <p className="text-sm text-muted-foreground py-10 text-center font-bold uppercase tracking-wide">
                Nenhum BA ainda — inicie a fila
              </p>
            )}
            {hits.map((h) => (
              <div
                key={h.id}
                className="border-2 border-red-600 rounded-xl p-4 bg-card/50 space-y-2 shadow-[3px_3px_0_#dc2626]"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <Badge className="bg-red-600 text-white font-black uppercase text-[8px] mb-1">
                      {h.motivoBa}
                    </Badge>
                    <p className="font-black text-sm uppercase">{h.clienteBusca}</p>
                    <p className="font-mono text-xs font-bold">{h.processo || "—"}</p>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase">
                      {h.data || "—"} · {h.tribunal || ""} {h.orgao || ""}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {h.processo && (
                      <Button asChild variant="outline" size="sm" className="rounded-xl text-[8px] font-black uppercase h-8">
                        <Link href={`/cases?search=${encodeURIComponent(h.processo)}`}>Processo</Link>
                      </Button>
                    )}
                    {h.link && (
                      <Button asChild variant="outline" size="sm" className="rounded-xl text-[8px] font-black uppercase h-8">
                        <a href={h.link} target="_blank" rel="noreferrer">
                          <ExternalLink size={12} />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {h.matches.map((m, i) => (
                    <Badge key={i} variant="secondary" className="text-[8px] font-black uppercase gap-1">
                      {m.tipo === "cliente" || m.tipo === "titular" ? <User size={10} /> : <Briefcase size={10} />}
                      {m.tipo}: {m.nome}
                    </Badge>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-4 whitespace-pre-wrap">{h.trecho}</p>
              </div>
            ))}
          </div>

          <div className="lg:col-span-2 space-y-2">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Log da fila
            </h2>
            <div className="border-2 border-border rounded-xl p-3 max-h-[60vh] overflow-auto bg-secondary/20 font-mono text-[10px] space-y-1">
              {logs.length === 0 && <p className="text-muted-foreground">—</p>}
              {logs.map((l, i) => (
                <div key={i} className="border-b border-border/30 pb-1">
                  {l}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
