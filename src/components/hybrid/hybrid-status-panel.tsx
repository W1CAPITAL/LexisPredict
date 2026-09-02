/* src/components/hybrid/hybrid-status-panel.tsx */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Database,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

type Health = {
  ok: boolean;
  mode?: string;
  webhook?: "ok" | "fail" | "not-configured";
  supabase?: "ok" | "fail" | "not-configured";
  total?: number | null;
  empresaId?: string | null;
  error?: string;
};

type BatchResponse = {
  ok: boolean;
  total: number;
  processed: number;
  accepted: number;
  nextCursor: string | null;
  hasMore: boolean;
  elapsedMs: number;
  error?: string;
};

type Checkpoint = {
  cursor: string | null;
  processed: number;
  total: number;
  startedAt: number;
};

const CHECKPOINT_KEY = "lexis_hybrid_sync_checkpoint_v3";
const BATCH_SIZE = 500;
const REQUEST_TIMEOUT_MS = 35_000;

function fmt(n: number) {
  return new Intl.NumberFormat("pt-BR").format(Math.max(0, n));
}

function safePct(processed: number, total: number) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, (processed / total) * 100));
}

export function HybridStatusPanel() {
  const [health, setHealth] = useState<Health | null>(null);
  const [running, setRunning] = useState(false);
  const [processed, setProcessed] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [lastBatchMs, setLastBatchMs] = useState<number | null>(null);
  const [message, setMessage] = useState("Planilha vazia — rode sync (seed)");

  const refreshHealth = useCallback(async () => {
    try {
      const ctrl = new AbortController();
      const timer = window.setTimeout(() => ctrl.abort(), 10_000);
      const res = await fetch("/api/hybrid/sync?mode=health", {
        method: "GET",
        cache: "no-store",
        signal: ctrl.signal,
      });
      window.clearTimeout(timer);
      const data = (await res.json()) as Health;
      setHealth(data);
      if (!data.ok && data.error) setError(data.error);
    } catch (err: any) {
      setHealth({ ok: false, supabase: "fail", webhook: "fail", error: err?.message || "Falha de conexão" });
    }
  }, []);

  useEffect(() => {
    void refreshHealth();
    const id = window.setInterval(() => void refreshHealth(), 15_000);
    return () => window.clearInterval(id);
  }, [refreshHealth]);

  useEffect(() => {
    if (!running || startedAt == null) {
      setElapsed(0);
      return;
    }
    const id = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1_000);
    return () => window.clearInterval(id);
  }, [running, startedAt]);

  const checkpoint = useMemo<Checkpoint | null>(() => {
    try {
      const raw = localStorage.getItem(CHECKPOINT_KEY);
      if (!raw) return null;
      const value = JSON.parse(raw) as Checkpoint;
      if (!value || typeof value.processed !== "number" || typeof value.total !== "number") return null;
      return value;
    } catch {
      return null;
    }
  }, [message]);

  const saveCheckpoint = (value: Checkpoint) => {
    try {
      localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(value));
    } catch {
      // Cache de progresso é opcional.
    }
  };

  const clearCheckpoint = () => {
    try {
      localStorage.removeItem(CHECKPOINT_KEY);
    } catch {
      // noop
    }
  };

  const runSync = useCallback(async (force: boolean) => {
    if (running) return;

    setRunning(true);
    setError("");
    const cp = force ? null : checkpoint;
    let cursor = cp?.cursor ?? null;
    let done = cp?.processed ?? 0;
    let knownTotal = cp?.total ?? 0;
    const started = Date.now();

    setStartedAt(started);
    setProcessed(done);
    setTotal(knownTotal);
    setMessage(force ? "Reiniciando seed..." : cp ? "Retomando seed interrompido..." : "Preparando seed...");

    try {
      for (;;) {
        const ctrl = new AbortController();
        const timeout = window.setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);

        let res: Response;
        try {
          res = await fetch("/api/hybrid/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
            signal: ctrl.signal,
            body: JSON.stringify({
              action: "seed_batch",
              cursor,
              batchSize: BATCH_SIZE,
            }),
          });
        } finally {
          window.clearTimeout(timeout);
        }

        const data = (await res.json()) as BatchResponse;
        if (!res.ok || !data.ok) {
          throw new Error(data.error || `Falha no lote HTTP ${res.status}`);
        }

        knownTotal = Number(data.total || knownTotal || 0);
        done += Number(data.accepted || data.processed || 0);
        cursor = data.nextCursor ?? null;

        setTotal(knownTotal);
        setProcessed(Math.min(done, knownTotal || done));
        setLastBatchMs(data.elapsedMs ?? null);

        saveCheckpoint({
          cursor,
          processed: done,
          total: knownTotal,
          startedAt: started,
        });

        const pct = safePct(done, knownTotal);
        setMessage(
          data.hasMore
            ? `Sincronizando lote · ${pct.toFixed(1)}%`
            : "Confirmando conclusão..."
        );

        if (!data.hasMore) {
          clearCheckpoint();
          setProcessed(knownTotal || done);
          setMessage(`✓ Seed concluído · ${fmt(knownTotal || done)} processos`);
          await refreshHealth();
          break;
        }
      }
    } catch (err: any) {
      setError(err?.name === "AbortError"
        ? "O lote excedeu o tempo limite. O ponto de retomada foi preservado."
        : err?.message || String(err));
      setMessage("Sincronização interrompida — pode retomar do último lote");
    } finally {
      setRunning(false);
      setStartedAt(null);
    }
  }, [checkpoint, refreshHealth, running]);

  const pct = safePct(processed, total);
  const rate = elapsed > 0 ? processed / elapsed : 0;
  const eta = rate > 0 && total > processed ? Math.ceil((total - processed) / rate) : 0;

  return (
    <section className="rounded-2xl border border-border bg-card shadow-sm p-3 sm:p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${health?.ok ? "bg-emerald-500" : "bg-amber-400"}`} />
          <span className="font-black text-xs uppercase tracking-wide">Estado da sincronização</span>
        </div>
        <Button type="button" size="sm" variant="outline" disabled={running} onClick={() => void refreshHealth()}>
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-1">Sincronizar</span>
        </Button>
      </div>

      <p className="text-[10px] text-muted-foreground font-semibold">{message}</p>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border px-3 py-2">
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Fonte carteira</p>
          <p className="text-xs font-black">{health?.supabase === "ok" ? "supabase" : "indisponível"}</p>
        </div>
        <div className="rounded-xl border px-3 py-2">
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Linhas planilha</p>
          <p className="text-xs font-black">{health?.total != null ? fmt(health.total) : "—"}</p>
        </div>
        <div className="rounded-xl border px-3 py-2">
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Webhook</p>
          <p className="text-xs font-black flex items-center gap-1">
            {health?.webhook === "ok" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <TriangleAlert className="h-3.5 w-3.5 text-amber-500" />}
            {health?.webhook === "ok" ? "OK" : health?.webhook === "not-configured" ? "não configurado" : "falha"}
          </p>
        </div>
        <div className="rounded-xl border px-3 py-2">
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Ping</p>
          <p className="text-xs font-black">pong</p>
        </div>
      </div>

      {running || processed > 0 || checkpoint ? (
        <div className="rounded-xl border bg-muted/20 p-3 space-y-2">
          <div className="flex justify-between text-[10px] font-bold">
            <span>{fmt(processed)} / {fmt(total || processed)}</span>
            <span>{total ? `${pct.toFixed(1)}%` : "calculando..."}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-foreground transition-[width] duration-300"
              style={{ width: `${Math.max(total ? pct : 4, running ? 4 : 0)}%` }}
            />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[9px] text-muted-foreground">
            <span>Lote: {BATCH_SIZE}</span>
            <span>Tempo: {elapsed}s</span>
            {rate > 0 ? <span>Velocidade: {rate.toFixed(1)} proc/s</span> : null}
            {eta > 0 ? <span>ETA: ~{eta}s</span> : null}
            {lastBatchMs != null ? <span>Último lote: {(lastBatchMs / 1000).toFixed(1)}s</span> : null}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => void runSync(false)} disabled={running || health?.supabase !== "ok"}>
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
          <span className="ml-1">Sincronizar agora</span>
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => void runSync(true)} disabled={running || health?.supabase !== "ok"}>
          <RotateCcw className="h-4 w-4" />
          <span className="ml-1">Forçar seed Supabase → Sheets</span>
        </Button>
      </div>

      <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
        <ShieldCheck className="h-3 w-3" />
        <span>Lotes de {BATCH_SIZE}; o checkpoint permite retomar sem reenviar os lotes concluídos.</span>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[10px] font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      ) : null}
    </section>
  );
}

export default HybridStatusPanel;
