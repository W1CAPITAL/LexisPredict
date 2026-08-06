"use client";

/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 */

import React, { useMemo } from 'react';
import { LegalCase } from '@/lib/case-logic';
import { isCasoEncerrado } from '@/lib/status-encerrado';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Building2, TrendingDown, Zap } from 'lucide-react';

interface OfficeStatsProps {
  cases: LegalCase[];
  className?: string;
}

export function OfficeStats({ cases, className }: OfficeStatsProps) {
  const stats = useMemo(() => {
    const groups: Record<string, {
      name: string;
      total: number;
      vencidos: number;
      alerta: number;
      ativos: number;
      encerrados: number;
      score: number;
    }> = {};

    // DEDUPE LOCAL PARA SEGURANÇA (Evita dezenas de milhares de registros fantasmas)
    const uniqueMap = new Map<string, LegalCase>();
    cases.forEach(c => {
      if (c && c.protocolo) uniqueMap.set(c.protocolo, c);
    });

    uniqueMap.forEach(c => {
      const officeName = (c.escritorio || "Sem Escritório").trim().toUpperCase();
      
      if (!groups[officeName]) {
        groups[officeName] = {
          name: officeName,
          total: 0,
          vencidos: 0,
          alerta: 0,
          ativos: 0,
          encerrados: 0,
          score: 0
        };
      }

      const group = groups[officeName];
      group.total++;

      if (isCasoEncerrado(c)) {
        group.encerrados++;
      } else {
        group.ativos++;
        // Status Vencido deve incluir Caso Crítico para bater com os cards
        if (c.status === 'Vencido' || c.status === 'Caso Crítico') {
          group.vencidos++;
        } else if (['É Hoje', 'Atenção'].includes(c.status)) {
          group.alerta++;
        }
      }
    });

    return Object.values(groups).map(g => {
      // Cálculo de Eficiência: Encerramentos (+15) vs Vencidos (-25)
      const calculatedScore = (g.encerrados * 15) + (g.ativos * 2) - (g.vencidos * 25);
      return { ...g, score: calculatedScore };
    }).sort((a, b) => b.score - a.score);
  }, [cases]);

  if (cases.length === 0) return null;

  return (
    <section className={cn("premium-card overflow-hidden", className)}>
      <div className="px-8 py-6 border-b border-border/30 flex items-center justify-between bg-black text-white">
        <div className="flex items-center gap-3">
          <Building2 size={18} className="text-primary" />
          <h3 className="text-[11px] font-black uppercase tracking-[0.25em]">Telemetria de Performance por Escritório</h3>
        </div>
        <Badge variant="outline" className="text-[9px] font-black uppercase border-white/20 text-white">
          {stats.length} Unidades Auditadas
        </Badge>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-card border-b border-border/30">
            <tr className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
              <th className="px-8 py-4">Escritório / Unidade</th>
              <th className="px-8 py-4 text-center">Avaliação Neural</th>
              <th className="px-8 py-4 text-center">Vencidos</th>
              <th className="px-8 py-4 text-center">Baixas</th>
              <th className="px-8 py-4 text-right">Eficiência</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {stats.length > 0 ? stats.map((office) => (
              <tr key={office.name} className="hover:bg-secondary/20 transition-colors group">
                <td className="px-8 py-5">
                  <span className="font-bold uppercase text-[12px] text-foreground group-hover:text-primary transition-colors">
                    {office.name}
                  </span>
                </td>
                <td className="px-8 py-5 text-center">
                   <div className="flex items-center justify-center gap-2">
                     {office.score > 50 ? (
                       <Badge className="bg-emerald-500 text-white border-none font-black text-[8px] uppercase px-2 py-0.5 flex items-center gap-1">
                         <Zap size={10} /> Unidade Elite
                       </Badge>
                     ) : office.score >= 0 ? (
                       <Badge className="bg-blue-500 text-white border-none font-black text-[8px] uppercase px-2 py-0.5">
                         Estável
                       </Badge>
                     ) : (
                       <Badge className="bg-red-500 text-white border-none font-black text-[8px] uppercase px-2 py-0.5 flex items-center gap-1">
                         <TrendingDown size={10} /> Risco Crítico
                       </Badge>
                     )}
                   </div>
                </td>
                <td className="px-8 py-5 text-center">
                  <span className={cn(
                    "text-[11px] font-black tabular-nums",
                    office.vencidos > 0 ? "text-red-600" : "text-muted-foreground/30"
                  )}>
                    {office.vencidos}
                  </span>
                </td>
                <td className="px-8 py-5 text-center">
                  <span className={cn(
                    "text-[11px] font-black tabular-nums",
                    office.encerrados > 0 ? "text-emerald-600" : "text-muted-foreground/30"
                  )}>
                    {office.encerrados}
                  </span>
                </td>
                <td className="px-8 py-5 text-right">
                  <div className="flex flex-col items-end">
                    <span className={cn(
                      "text-xs font-black tabular-nums",
                      office.score > 0 ? "text-emerald-600" : "text-red-600"
                    )}>
                      {office.score > 0 ? `+${new Intl.NumberFormat('pt-BR').format(office.score)}` : new Intl.NumberFormat('pt-BR').format(office.score)}
                    </span>
                    <span className="text-[7px] font-bold text-muted-foreground uppercase">Authority Points</span>
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={5} className="px-8 py-10 text-center text-[10px] font-black uppercase text-muted-foreground opacity-40">
                  Nenhum escritório cadastrado nos processos
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
