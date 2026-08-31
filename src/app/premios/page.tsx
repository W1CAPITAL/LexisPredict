"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Awards } from "@/components/ui/award";
import { Button } from "@/components/ui/button";
import { Loader2, Trophy, Download } from "lucide-react";
import { listarRankingAtendimentoMesAction } from "@/app/actions/ranking-atendimento-actions";
import { downloadCertificadoPdf } from "@/lib/premio-certificado-pdf";
import { useToast } from "@/hooks/use-toast";

type RankRow = { nome: string; score: number; detalhe?: string };

export default function PremiosPage() {
  const [rows, setRows] = useState<RankRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const { toast } = useToast();
  const mes = useMemo(
    () => new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
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

  const baixar = async (r: RankRow, rank: 1 | 2 | 3) => {
    setBusy(rank);
    try {
      await downloadCertificadoPdf({
        recipient: r.nome,
        rank,
        monthLabel: mes,
        detalhe: r.detalhe,
      });
      toast({ title: "PDF gerado", description: r.nome });
    } catch (e: any) {
      toast({ title: "Falha no PDF", description: e?.message || "Erro", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-4 sm:p-8">
        <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center shadow-lg">
                <Trophy className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight">Hall de prêmios</h1>
                <p className="text-sm text-muted-foreground">
                  Nome completo do operador · {mes}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              className="gap-2"
              disabled={!top.length || busy !== null}
              onClick={async () => {
                for (let i = 0; i < top.length; i++) {
                  await baixar(top[i], (i + 1) as 1 | 2 | 3);
                }
              }}
            >
              <Download size={16} /> Baixar top 3 (PDF)
            </Button>
          </header>

          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-20 justify-center">
              <Loader2 className="animate-spin" /> Calculando ranking…
            </div>
          ) : top.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground space-y-2">
              <p className="font-semibold text-foreground">Nenhum operador no ranking deste mês</p>
              <p className="text-sm max-w-md mx-auto">
                O hall usa atendimentos registrados (botão Atender) e logs de auditoria.
                Sistema interno / W1 CONTROL / scanner não entram. Registre atendimentos em
                /cases ou /processos e atualize esta página.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {top.map((r, i) => (
                <div key={r.nome + i} className="space-y-2">
                  <Awards
                    variant="certificate"
                    rank={(i + 1) as 1 | 2 | 3}
                    title="WINNER"
                    subtitle={`Análise de processos jurídicos · ${r.detalhe || `${r.score} pts`}`}
                    recipient={r.nome}
                    date={mes}
                  />
                  <p className="text-center text-[12px] font-bold px-2 break-words">{r.nome}</p>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="w-full gap-2"
                    disabled={busy !== null}
                    onClick={() => void baixar(r, (i + 1) as 1 | 2 | 3)}
                  >
                    {busy === i + 1 ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
                    Baixar certificado PDF
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
