"use client";

/**
 * F5 — IA Preditiva / Analytics: padrões por tribunal, vara e juiz.
 * Risco, procedência de sentenças e tempo médio de baixa com export XLSX.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { buildXlsxWithSheetJS } from "@/lib/sheetjs-bridge";
import { Sidebar } from "@/components/layout/sidebar";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { fetchRepoCases } from "@/app/actions/case-actions";
import { calcularEstatisticas, type InsightsResultado, type GrupoStats } from "@/lib/ia-preditiva";
import type { LegalCase } from "@/lib/case-logic";
import {
  Loader2,
  Scale,
  Gavel,
  Clock,
  ShieldAlert,
  Trophy,
  TrendingUp,
  FileDown,
  BrainCircuit,
  Building2,
} from "lucide-react";

function RiscoBar({ risco }: { risco: number }) {
  const cor =
    risco >= 70 ? "bg-red-500" : risco >= 40 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", cor)} style={{ width: `${risco}%` }} />
      </div>
      <span className="text-xs font-medium tabular-nums">{risco}%</span>
    </div>
  );
}

function TableTribunal({ titulo, descricao, grupos }: { titulo: string; descricao: string; grupos: GrupoStats[] }) {
  if (!grupos.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="h-4 w-4 text-primary" />
          {titulo}
        </CardTitle>
        <CardDescription>{descricao}</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[420px]">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="sticky top-0 bg-background">
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-4">Tribunal / Vara</th>
                <th className="py-2 pr-4 text-center">Total</th>
                <th className="py-2 pr-4 text-center">Ativos</th>
                <th className="py-2 pr-4 text-center">Vencidos</th>
                <th className="py-2 pr-4 text-center">Novo Andam.</th>
                <th className="py-2 pr-4 text-center">Baixas</th>
                <th className="py-2 pr-4 text-center">Proc.</th>
                <th className="py-2 pr-4 text-center">Improc.</th>
                <th className="py-2 pr-4 text-center">Taxa Proc.</th>
                <th className="py-2 pr-4 text-center">Tempo Baixa</th>
                <th className="py-2 text-center">Risco</th>
              </tr>
            </thead>
            <tbody>
              {grupos.map((g) => (
                <tr key={g.chave} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="py-2 pr-4 font-medium">{g.chave}</td>
                  <td className="py-2 pr-4 text-center tabular-nums">{g.total}</td>
                  <td className="py-2 pr-4 text-center tabular-nums">{g.ativos}</td>
                  <td className="py-2 pr-4 text-center tabular-nums">
                    <Badge variant={g.vencidos > 0 ? "destructive" : "outline"}>{g.vencidos}</Badge>
                  </td>
                  <td className="py-2 pr-4 text-center tabular-nums">{g.novoAndamento}</td>
                  <td className="py-2 pr-4 text-center tabular-nums">{g.baixas}</td>
                  <td className="py-2 pr-4 text-center tabular-nums text-emerald-600">{g.procedentes}</td>
                  <td className="py-2 pr-4 text-center tabular-nums text-red-600">{g.improcedentes}</td>
                  <td className="py-2 pr-4 text-center tabular-nums">{g.taxaProcedencia}%</td>
                  <td className="py-2 pr-4 text-center tabular-nums">
                    {g.tempoMedioBaixaDias != null ? `${g.tempoMedioBaixaDias}d` : "—"}
                  </td>
                  <td className="py-2 text-center">
                    <RiscoBar risco={g.risco} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export default function InsightsPage() {
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState<LegalCase[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      try {
        const dados = await fetchRepoCases();
        setCases(Array.isArray(dados) ? dados : []);
      } catch {
        toast({ title: "Erro", description: "Falha ao carregar a carteira.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const r = useMemo<InsightsResultado>(() => calcularEstatisticas(cases), [cases]);
  const semDados = !loading && r.geral.total === 0;

  const exportar = async () => {
    const headers = [
      "Tribunal",
      "Total",
      "Ativos",
      "Vencidos",
      "Novo Andamento",
      "Baixas",
      "Procedentes",
      "Improcedentes",
      "Sem Definição",
      "Taxa de Procedência (%)",
      "Tempo Médio de Baixa (dias)",
      "Risco (%)",
    ];
    const aoa = r.tribunais.map((g) => [
      g.chave,
      g.total,
      g.ativos,
      g.vencidos,
      g.novoAndamento,
      g.baixas,
      g.procedentes,
      g.improcedentes,
      g.semDefinicao,
      g.taxaProcedencia,
      g.tempoMedioBaixaDias ?? "",
      g.risco,
    ]);
    try {
      const u8 = await buildXlsxWithSheetJS([{ name: "IA Preditiva", rows: [headers, ...aoa] }]);
      const blob = new Blob([u8], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ia-preditiva-tribunais.xlsx";
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Exportado", description: "ia-preditiva-tribunais.xlsx gerado." });
    } catch {
      toast({ title: "Erro", description: "Falha ao gerar o arquivo XLSX.", variant: "destructive" });
    }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 px-4 py-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold">
                <BrainCircuit className="h-6 w-6 text-primary" />
                IA Preditiva
              </h1>
              <p className="text-sm text-muted-foreground">
                Padrões por tribunal, vara e juiz — risco, procedência de sentenças e tempo de baixa.
              </p>
            </div>
            {!semDados && (
              <Button variant="outline" size="sm" onClick={exportar} disabled={loading}>
                <FileDown className="h-4 w-4" />
                Exportar XLSX
              </Button>
            )}
          </div>

          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : semDados ? (
            <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-lg border border-dashed">
              <p className="text-sm text-muted-foreground">
                Importe a carteira para liberar a IA Preditiva.
              </p>
              <Link href="/import">
                <Button>Importar Carteira</Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard title="Casos ativos" value={r.geral.ativos} icon={<Gavel />} color="primary" />
                <StatCard title="Baixas" value={r.geral.baixas} icon={<Gavel />} color="success" />
                <StatCard
                  title="Taxa de procedência"
                  value={`${r.geral.taxaProcedenciaGeral}%`}
                  icon={<Scale />}
                  color="accent"
                />
                <StatCard
                  title="Risco médio"
                  value={`${r.geral.riscoMedio}%`}
                  icon={<ShieldAlert />}
                  color={r.geral.riscoMedio >= 40 ? "warning" : "success"}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <ShieldAlert className="h-4 w-4 text-red-500" />
                      Maior risco
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {r.insights.tribunalMaiorRisco ? (
                      <div>
                        <p className="font-medium">{r.insights.tribunalMaiorRisco.chave}</p>
                        <RiscoBar risco={r.insights.tribunalMaiorRisco.risco} />
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Sem dados.</p>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Trophy className="h-4 w-4 text-amber-500" />
                      Maior taxa de procedência
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {r.insights.tribunalMaiorProcedencia ? (
                      <div>
                        <p className="font-medium">{r.insights.tribunalMaiorProcedencia.chave}</p>
                        <p className="text-sm font-semibold tabular-nums">
                          {r.insights.tribunalMaiorProcedencia.taxaProcedencia}%
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Sem dados.</p>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-primary" />
                      Baixa mais demorada
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {r.insights.tribunalMaisLento && r.insights.tribunalMaisLento.tempoMedioBaixaDias != null ? (
                      <div>
                        <p className="font-medium">{r.insights.tribunalMaisLento.chave}</p>
                        <p className="text-sm font-semibold tabular-nums">
                          {r.insights.tribunalMaisLento.tempoMedioBaixaDias} dias
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Sem baixas registradas.</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              <TableTribunal
                titulo="Por Tribunal"
                descricao="Padrões consolidados por tribunal com risco calculado."
                grupos={r.tribunais}
              />
              <TableTribunal
                titulo="Por Vara / Juiz"
                descricao="Padrões quando a vara ou juiz está informado no processo."
                grupos={r.varas}
              />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
