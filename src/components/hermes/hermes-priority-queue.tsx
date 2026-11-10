"use client";

import React from "react";
import Link from "next/link";
import { Bot, ChevronDown, ChevronUp, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { getHermesPriorityQueueAction } from "@/app/actions/hermes-return-actions";
import { HermesReturnReviewButton } from "@/components/hermes/hermes-return-review-button";
import { Button } from "@/components/ui/button";

type QueueItem = {
  processId: number;
  cliente: string;
  protocolo: string;
  dueOn: string;
  state: string;
  priorityScore: number;
  priorityLabel: string;
  checkedAt: string;
  suggestedNextReturn: string;
  topHighlight: string;
};
const date = (raw: string) => {
  const m = String(raw || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[3] + "/" + m[2] + "/" + m[1] : "—";
};

/** Work queue based only on saved, verified data scoped to the logged-in company. */
export function HermesPriorityQueue() {
  const [open, setOpen] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [items, setItems] = React.useState<QueueItem[]>([]);

  const load = React.useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const result = await getHermesPriorityQueueAction();
      if (!result.ok) throw new Error(result.error);
      setItems(result.items as QueueItem[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fila indisponível.");
    } finally {
      setBusy(false);
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  return (
    <section className="overflow-hidden rounded-2xl border border-[#87435d]/25 bg-card text-card-foreground shadow-md" data-hermes-return-queue>
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#4b1b34] p-4 text-white">
        <div>
          <h2 className="flex items-center gap-2 text-base font-extrabold"><Bot size={20}/> Hermes · Fila inteligente de retornos</h2>
          <p className="mt-1 text-xs text-[#e9cddd]">Prioridades e pontos principais extraídos das consultas DJEN/DataJud. Atendimento não é registrado automaticamente.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" onClick={() => void load()} disabled={busy} variant="outline" className="h-9 gap-1 border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white">
            {busy ? <Loader2 size={14} className="animate-spin"/> : <RefreshCw size={14}/>} Atualizar
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setOpen((value) => !value)} className="h-9 gap-1 border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white">
            {open ? <ChevronUp size={14}/> : <ChevronDown size={14}/>} {open ? "Ocultar" : "Mostrar"}
          </Button>
        </div>
      </div>
      {open ? (
        <div className="space-y-2 p-3">
          {error && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-200">{error}</p>}
          {!error && !busy && items.length === 0 && <p className="p-3 text-sm text-muted-foreground">Nenhum retorno válido vencido nesta carteira. Datas inconsistentes não entram na fila; a consulta automática ocorrerá quando chegar uma data válida.</p>}
          {items.slice(0, 15).map((item, index) => (
            <article key={item.processId} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-background/80 p-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#803b59]/15 text-sm font-black text-[#8c3c61] dark:text-[#e8b9d0]">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground">{item.cliente}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Retorno: {date(item.dueOn)} · Verificado: {date(item.checkedAt)}</p>
                {item.topHighlight ? <p className="mt-1 line-clamp-2 text-xs text-foreground/85">{item.topHighlight}</p> : null}
                {item.state === "unavailable" && <p className="mt-1 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300"><ShieldAlert size={12}/> Fontes indisponíveis: requer conferência</p>}
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <span className="rounded-full border border-[#924f6c]/30 bg-[#924f6c]/10 px-2 py-1 text-xs font-bold text-[#873f5e] dark:text-[#f0c5d6]">{item.priorityLabel} · {item.priorityScore}</span>
                <HermesReturnReviewButton processId={item.processId} compact/>
                <Link className="rounded-lg border border-border px-3 py-2 text-xs font-bold text-foreground hover:bg-muted" href={"/processos?search=" + encodeURIComponent(item.protocolo)}>
                  Ver processo
                </Link>
              </div>
            </article>
          ))}
          {items.length > 15 ? <p className="px-3 text-xs text-muted-foreground">Exibindo os 15 retornos de maior prioridade entre {items.length} análises atuais.</p> : null}
        </div>
      ) : null}
    </section>
  );
}
