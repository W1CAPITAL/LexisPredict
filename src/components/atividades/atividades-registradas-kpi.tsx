"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";
import { getAtividadesRegistradasCountAction, type AtividadeResponsavelKpi } from "@/app/actions/atividades-registradas-actions";
import { cn } from "@/lib/utils";

export function AtividadesRegistradasKpi({ className = "" }: { className?: string }) {
  const [count, setCount] = useState<number | null>(null);
  const [responsaveis, setResponsaveis] = useState<AtividadeResponsavelKpi[]>([]);
  const [error, setError] = useState(false);
  const maxCount = Math.max(1, ...responsaveis.map(item => item.registros));

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
          setResponsaveis(result.responsaveis);
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
    const timer = window.setInterval(onRefresh, 300_000);
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
      aria-label="Total de atividades cadastradas no LexisPredict por responsável"
      className={cn("w-full max-w-[380px] rounded-2xl border border-border/70 bg-card/90 p-4 shadow-sm transition-colors hover:border-primary/30", className)}
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
        Total da empresa · separado por quem cadastrou · somente usuários com registros
      </p>
      {responsaveis.length > 0 ? (
        <div className="mt-3 max-h-64 space-y-3 overflow-y-auto border-t border-border/70 pt-3">
          {responsaveis.map(item => (
            <div key={item.userId} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-xs font-bold text-foreground" title={item.nome}>{item.nome}</span>
                <span className="shrink-0 text-sm font-black tabular-nums text-foreground">{item.registros.toLocaleString("pt-BR")}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: (item.registros / maxCount * 100) + "%" }} />
              </div>
              <p className="text-[10px] leading-4 text-muted-foreground">
                {item.processos.toLocaleString("pt-BR")} referências de processo · {item.contatosMarcados.toLocaleString("pt-BR")} contatos marcados · {item.semReferencia.toLocaleString("pt-BR")} sem referência
              </p>
            </div>
          ))}
        </div>
      ) : count === 0 ? (
        <p className="mt-3 border-t border-border/70 pt-3 text-[11px] text-muted-foreground">Nenhuma atividade cadastrada nesta empresa.</p>
      ) : null}
      <Link href="/minhas-atividades" className="mt-3 inline-flex text-[11px] font-semibold text-primary underline underline-offset-2">Abrir meu histórico completo com dados dos processos</Link>
      {error && count === null ? (
        <p className="mt-2 text-[10px] text-amber-600 dark:text-amber-400">
          Contagem temporariamente indisponível.
        </p>
      ) : null}
    </section>
  );
}
