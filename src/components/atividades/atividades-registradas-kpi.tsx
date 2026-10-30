"use client";

import { useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";
import { getAtividadesRegistradasCountAction } from "@/app/actions/atividades-registradas-actions";
import { cn } from "@/lib/utils";

export function AtividadesRegistradasKpi({ className = "" }: { className?: string }) {
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    let pending = false;
    const refresh = async () => {
      if (pending) return;
      pending = true;
      try {
        const result = await getAtividadesRegistradasCountAction();
        if (!active) return;
        if (result.ok) {
          setCount(result.count);
          setError(false);
        } else {
          setError(true);
        }
      } catch {
        if (active) setError(true);
      } finally {
        pending = false;
      }
    };
    const onRefresh = () => {
      if (!document.hidden) void refresh();
    };
    void refresh();
    window.addEventListener("focus", onRefresh);
    window.addEventListener("lexis-carteira-updated", onRefresh);
    window.addEventListener("lexis-atividade-registrada", onRefresh);
    document.addEventListener("visibilitychange", onRefresh);
    const timer = window.setInterval(onRefresh, 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", onRefresh);
      window.removeEventListener("lexis-carteira-updated", onRefresh);
      window.removeEventListener("lexis-atividade-registrada", onRefresh);
      document.removeEventListener("visibilitychange", onRefresh);
    };
  }, []);

  return (
    <section
      aria-label="Total de atividades cadastradas no LexisPredict"
      className={cn("w-full max-w-[340px] rounded-2xl border border-border/70 bg-card/90 p-4 shadow-sm transition-colors hover:border-primary/30", className)}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-[.12em] text-muted-foreground">
          Atividades cadastradas
        </p>
        <ClipboardList className="h-4 w-4 text-primary" aria-hidden="true" />
      </div>
      <p className="mt-2 text-3xl font-black tracking-tight tabular-nums text-foreground">
        {count === null ? "—" : count.toLocaleString("pt-BR")}
      </p>
      <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
        Registros salvos em Minhas atividades · empresa inteira
      </p>
      {error && count === null ? (
        <p className="mt-2 text-[10px] text-amber-600 dark:text-amber-400">
          Contagem temporariamente indisponível.
        </p>
      ) : null}
    </section>
  );
}
