"use client";

/**
 * Certificados — Top 3 atendentes do mês (análise de processos jurídicos).
 */

import React, { useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Awards } from "@/components/ui/award";
import { Button } from "@/components/ui/button";
import { Loader2, Trophy } from "lucide-react";
import { listarRankingAtendimentoMesAction } from "@/app/actions/ranking-atendimento-actions";

type RankRow = { nome: string; score: number; detalhe?: string };

export default function PremiosPage() {
  const [rows, setRows] = useState<RankRow[]>([]);
  const [loading, setLoading] = useState(true);
  const mes = useMemo(
    () =>
      new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    []
  );

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await listarRankingAtendimentoMesAction();
        setRows((data as RankRow[]) || []);
      } catch {
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const top = rows.slice(0, 3);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-4 sm:p-8">
        <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
          <header className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center shadow-lg">
              <Trophy className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight">Hall de prêmios</h1>
              <p className="text-sm text-muted-foreground">
                Melhores atendentes · análise de processos jurídicos · {mes}
              </p>
            </div>
          </header>

          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-20 justify-center">
              <Loader2 className="animate-spin" /> Calculando ranking…
            </div>
          ) : top.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
              Ainda não há dados suficientes este mês. Atendimentos registrados alimentam o ranking.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {top.map((r, i) => (
                <Awards
                  key={r.nome + i}
                  variant="certificate"
                  rank={(i + 1) as 1 | 2 | 3}
                  title="WINNER"
                  subtitle={`Análise de processos jurídicos · ${r.detalhe || `${r.score} pts`}`}
                  recipient={r.nome}
                  date={mes}
                />
              ))}
            </div>
          )}

          <Button variant="outline" onClick={() => window.location.reload()}>
            Atualizar ranking
          </Button>
        </div>
      </main>
    </div>
  );
}
