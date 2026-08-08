"use client";

/**
 * G2 — KPIs Revisional & Jurídico (clientes salvos no Supabase).
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Calculator, Gavel, CalendarClock, ArrowRight } from "lucide-react";
import { listarClientesOperacaoAction } from "@/app/actions/clientes-operacao-actions";

export function RevisionalJuridicoKpis() {
  const [kpis, setKpis] = useState<{ revisional: number; juridico: number; prazos: number }>({ revisional: 0, juridico: 0, prazos: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const res = await listarClientesOperacaoAction("todos");
      if (!ativo) return;
      const items: any[] = res?.success ? (res.items || []) : [];
      const hoje = new Date().toISOString().slice(0, 10);
      const limite = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
      const juridico = items.filter((c) => c.tipo === "juridico");
      let prazos = 0;
      for (const c of juridico) {
        const ands: any[] = c?.dados?.andamentos || [];
        prazos += ands.filter(
          (a) => a?.tipo === "prazo" && a?.data && a.data >= hoje && a.data <= limite
        ).length;
      }
      setKpis({
        revisional: items.filter((c) => c.tipo === "revisional").length,
        juridico: juridico.length,
        prazos,
      });
      setLoading(false);
    })();
    return () => { ativo = false; };
  }, []);

  const card = (label: string, value: React.ReactNode, icon: React.ReactNode, tone: string, href?: string) => (
    <Link
      href={href || "#"}
      className="rounded-2xl border border-border/50 bg-card/50 p-4 sm:p-5 shadow-sm backdrop-blur-sm hover:border-primary/40 transition-all flex items-center justify-between gap-3"
    >
      <div className="space-y-1">
        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className={`text-2xl sm:text-3xl font-black tabular-nums ${tone}`}>{loading ? "…" : value}</p>
      </div>
      <div className="flex items-center gap-2 text-muted-foreground/50">
        {icon}
        {href ? <ArrowRight size={14} /> : null}
      </div>
    </Link>
  );

  return (
    <section className="rounded-2xl border border-border/50 bg-card/40 p-3 sm:p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3 px-1">
        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">Revisional & Jurídico · Supabase</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {card("Análises revisional", kpis.revisional, <Calculator size={20} />, "text-primary", "/revisional")}
        {card("Processos jurídico", kpis.juridico, <Gavel size={20} />, "text-primary", "/juridico")}
        {card("Prazos ≤ 3 dias", kpis.prazos, <CalendarClock size={20} />, kpis.prazos > 0 ? "text-red-600 dark:text-red-400" : "text-primary")}
      </div>
    </section>
  );
}
