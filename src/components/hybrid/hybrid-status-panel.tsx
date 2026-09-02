"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Database, Loader2, RefreshCw, RotateCcw, ShieldCheck, TriangleAlert } from "lucide-react";

type Health = {
  ok: boolean;
  supabase?: "ok" | "fail";
  webhook?: "ok" | "fail";
  sheetsWorking?: boolean;
  total?: number;
  message?: string;
  webhookError?: string;
};

type BatchResponse = {
  ok: boolean;
  total: number;
  processed: number;
  accepted: number;
  nextCursor: string | null;
  hasMore: boolean;
  fallback?: "supabase";
  sheetsWorking?: boolean;
  error?: string;
  message?: string;
  elapsedMs?: number;
};

type Checkpoint = { cursor: string | null; processed: number; total: number; startedAt: number };
const CHECKPOINT_KEY = "lexis_hybrid_sync_checkpoint_v4";
const BATCH_SIZE = 75;
const REQUEST_TIMEOUT_MS = 12_000;

function fmt(n: number) { return new Intl.NumberFormat("pt-BR").format(Math.max(0, n)); }
function pct(done: number, total: number) { return total > 0 ? Math.min(100, (done / total) * 100) : 0; }

export default function HybridStatusPanel() {
  const [health, setHealth] = useState<Health | null>(null);
  const [running, setRunning] = useState(false);
  const [processed, setProcessed] = useState(0);
  const [total, setTotal] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("Pronto.");
  const [lastBatchMs, setLastBatchMs] = useState<number | null>(null);
  const [tick, setTick] = useState(0);

  const loadCheckpoint = useCallback((): Checkpoint | null => {
    try {
      const raw = localStorage.getItem(CHECKPOINT_KEY);
      if (!raw) return null;
      const cp = JSON.parse(raw) as Checkpoint;
      return typeof cp?.processed === "number" && typeof cp?.total === "number" ? cp : null;
    } catch { return null; }
  }, []);

  const refreshHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/hybrid/sync", { cache: "no-store" });
      const data = (await res.json()) as Health;
      setHealth(data);
      if (data.total != null) setTotal(Number(data.total));
      if (!data.sheetsWorking && data.message) setMessage(data.message);
      if (!data.sheetsWorking && data.webhookError) setError(data.webhookError);
    } catch (e: any) {
      // Não transformamos falha do painel em falha do sistema: Supabase continua normal.
      setHealth({ ok: true, supabase: "ok", sheetsWorking: false, webhook: "fail" });
      setMessage("Plano B indisponível; operação normal mantida pelo Supabase.");
      setError(e?.message || "Não foi possível verificar o Google Sheets.");
    }
  }, []);

  useEffect(() => {
    void refreshHealth();
    const id = window.setInterval(() => void refreshHealth(), 30_000);
    return () => window.clearInterval(id);
  }, [refreshHealth]);

  useEffect(() => {
    if (!running || startedAt == null) return;
    const id = window.setInterval(() => setTick((v) => v + 1), 1000);
    return () => window.clearInterval(id);
  }, [running, startedAt]);

  const elapsed = startedAt ? Math.floor((Date.now() - startedAt) / 1000) + tick * 0 : 0;
  const speed = elapsed > 0 ? processed / elapsed : 0;
  const remaining = total > processed ? total - processed : 0;
  const eta = speed > 0 ? Math.ceil(remaining / speed) : 0;
  const progress = pct(processed, total);

  const runSync = useCallback(async (force: boolean) => {
    if (running) return;
    const cp = force ? null : loadCheckpoint();
    let cursor = cp?.cursor ?? null;
    let done = cp?.processed ?? 0;
    const knownTotal = cp?.total || health?.total || 0;
    const start = Date.now();

    setRunning(true);
    setStartedAt(start);
    setError("");
    setMessage(force ? "Reiniciando sincronização..." : cp ? "Retomando do último lote confirmado..." : "Iniciando sincronização...");
    setProcessed(done);
    setTotal(knownTotal);

    try {
      while (true) {
        const ctrl = new AbortController();
        const timeout = window.setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
        let response: Response;
        try {
          response = await fetch("/api/hybrid/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
            signal: ctrl.signal,
            body: JSON.stringify({ action: "seed_batch", cursor, batchSize: BATCH_SIZE, total: knownTotal }),
          });
        } finally {
          window.clearTimeout(timeout);
        }

        const data = (await response.json()) as BatchResponse;
        setLastBatchMs(Number(data.elapsedMs || 0));

        if (!data.ok) {
          setMessage(data.message || "Plano B indisponível; Supabase continua ativo.");
          setError(data.error || "Google Sheets não confirmou o lote.");
          break;
        }

        done += Number(data.accepted || data.processed || 0);
        cursor = data.nextCursor ?? null;
        setProcessed(done);
        setTotal(Number(data.total || knownTotal || done));
        localStorage.setItem(CHECKPOINT_KEY, JSON.stringify({
          cursor, processed: done, total: Number(data.total || knownTotal || done), startedAt: start,
        }));

        if (!data.hasMore) {
          localStorage.removeItem(CHECKPOINT_KEY);
          setMessage(`✓ Planilha sincronizada · ${fmt(done)} processos`);
          break;
        }

        setMessage(`Sincronizando · ${fmt(done)} processos confirmados`);
      }
    } catch (e: any) {
      setMessage("Plano B interrompido; o Lexis continua funcionando pelo Supabase.");
      setError(e?.name === "AbortError" ? `Webhook excedeu ${REQUEST_TIMEOUT_MS / 1000}s; checkpoint preservado.` : (e?.message || String(e)));
    } finally {
      setRunning(false);
      setStartedAt(null);
      void refreshHealth();
    }
  }, [health?.total, loadCheckpoint, refreshHealth, running]);

  const checkpoint = useMemo(() => loadCheckpoint(), [loadCheckpoint, tick]);

  return (
    <section className="rounded-2xl border bg-card p-3 shadow-sm space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${health?.sheetsWorking ? "bg-emerald-500" : "bg-amber-400"}`} />
          <span className="font-black text-xs uppercase tracking-wide">Estado da sincronização</span>
        </div>
        <Button type="button" size="sm" variant="outline" disabled={running} onClick={() => void refreshHealth()}>
          <RefreshCw className="h-4 w-4" /> <span className="ml-1">Verificar</span>
        </Button>
      </div>

      <p className="text-[10px] font-semibold text-muted-foreground">{message}</p>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border px-3 py-2"><p className="text-[9px] text-muted-foreground uppercase">Supabase</p><p className="text-xs font-black">{health?.supabase === "ok" ? "OK" : "indisponível"}</p></div>
        <div className="rounded-xl border px-3 py-2"><p className="text-[9px] text-muted-foreground uppercase">Google Sheets</p><p className="text-xs font-black flex items-center gap-1">{health?.sheetsWorking ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <TriangleAlert className="h-3.5 w-3.5 text-amber-500" />}{health?.sheetsWorking ? "OK" : "OFF — fallback Supabase"}</p></div>
        <div className="rounded-xl border px-3 py-2"><p className="text-[9px] text-muted-foreground uppercase">Processos no banco</p><p className="text-xs font-black">{fmt(total || health?.total || 0)}</p></div>
        <div className="rounded-xl border px-3 py-2"><p className="text-[9px] text-muted-foreground uppercase">Lote</p><p className="text-xs font-black">{BATCH_SIZE}</p></div>
      </div>

      {(running || processed > 0 || checkpoint) && (
        <div className="rounded-xl border bg-muted/20 p-3 space-y-2">
          <div className="flex justify-between text-[10px] font-bold"><span>{fmt(processed)} / {fmt(total || processed)}</span><span>{total ? `${progress.toFixed(1)}%` : "—"}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-foreground transition-[width] duration-300" style={{ width: `${Math.max(total ? progress : 4, running ? 4 : 0)}%` }} /></div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[9px] text-muted-foreground"><span>Velocidade: {speed > 0 ? `${speed.toFixed(1)} proc/s` : "—"}</span><span>ETA: {eta > 0 ? `~${eta}s` : "—"}</span><span>Último lote: {lastBatchMs ? `${(lastBatchMs / 1000).toFixed(1)}s` : "—"}</span></div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={running || !health?.sheetsWorking} onClick={() => void runSync(false)}>
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}<span className="ml-1">Sincronizar agora</span>
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={running || !health?.sheetsWorking} onClick={() => void runSync(true)}>
          <RotateCcw className="h-4 w-4" /><span className="ml-1">Reiniciar seed</span>
        </Button>
      </div>

      <div className="flex items-center gap-1 text-[9px] text-muted-foreground"><ShieldCheck className="h-3 w-3" /><span>Se o Sheets falhar, nenhuma confirmação é inventada e o Supabase continua sendo a fonte operacional.</span></div>
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[10px] font-semibold text-red-700">{error}</div> : null}
    </section>
  );
}
