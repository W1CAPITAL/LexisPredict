/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 */
"use client";

import React, { useMemo } from 'react';
import { LegalCase } from '@/lib/case-logic';
import { isCasoEncerrado } from '@/lib/status-encerrado';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Building2, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

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
    }> = {};

    cases.forEach(c => {
      const officeName = (c.escritorio || "Sem Escritório").trim().toUpperCase();
      
      if (!groups[officeName]) {
        groups[officeName] = {
          name: officeName,
          total: 0,
          vencidos: 0,
          alerta: 0,
          ativos: 0,
          encerrados: 0
        };
      }

      const group = groups[officeName];
      group.total++;

      if (isCasoEncerrado(c)) {
        group.encerrados++;
      } else {
        group.ativos++;
        if (c.status === 'Vencido') {
          group.vencidos++;
        } else if (['É Hoje', 'Atenção'].includes(c.status)) {
          group.alerta++;
        }
      }
    });

    return Object.values(groups).sort((a, b) => {
      const scoreA = (a.vencidos * 10) + a.alerta;
      const scoreB = (b.vencidos * 10) + b.alerta;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return b.total - a.total;
    });
  }, [cases]);

  if (cases.length === 0) return null;

  return (
    <section className={cn("premium-card overflow-hidden", className)}>
      <div className="px-8 py-6 border-b border-border/30 flex items-center justify-between bg-secondary/10">
        <div className="flex items-center gap-3">
          <Building2 size={18} className="text-primary" />
          <h3 className="text-[11px] font-black uppercase tracking-[0.25em]">Estatísticas por Escritório</h3>
        </div>
        <Badge variant="outline" className="text-[9px] font-black uppercase border-border/50">
          {stats.length} Unidades Identificadas
        </Badge>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-card border-b border-border/30">
            <tr className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
              <th className="px-8 py-4">Escritório / Unidade</th>
              <th className="px-8 py-4 text-center">Ativos</th>
              <th className="px-8 py-4 text-center text-red-600">Vencidos</th>
              <th className="px-8 py-4 text-center text-orange-500">Alerta</th>
              <th className="px-8 py-4 text-center text-emerald-600">Baixas</th>
              <th className="px-8 py-4 text-right">Total</th>
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
                <td className="px-8 py-5 text-center text-[11px] font-black tabular-nums">{office.ativos}</td>
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
                    office.alerta > 0 ? "text-orange-500" : "text-muted-foreground/30"
                  )}>
                    {office.alerta}
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
                  <Badge variant="secondary" className="bg-secondary/50 font-black text-[10px] tabular-nums">
                    {office.total}
                  </Badge>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={6} className="px-8 py-10 text-center text-[10px] font-black uppercase text-muted-foreground opacity-40">
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
