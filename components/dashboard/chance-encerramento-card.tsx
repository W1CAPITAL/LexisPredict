/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 */
import React from 'react';
import { cn } from '@/lib/utils';
import { Target, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { ChanceAnalysis } from '@/lib/chance-encerramento-logic';

interface ChanceEncerramentoCardProps {
  analysis: ChanceAnalysis;
  className?: string;
}

export function ChanceEncerramentoCard({ analysis, className }: ChanceEncerramentoCardProps) {
  return (
    <div className={cn("bg-white border-2 border-black shadow-[8px_8px_0px_#000] rounded-none overflow-hidden flex flex-col h-full", className)}>
      <div className="bg-black text-white p-4 flex items-center justify-between">
        <h3 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
          <Target size={14} className="text-primary" /> Chance de Encerramento
        </h3>
        <BadgeLevel level={analysis.level} color={analysis.color} />
      </div>
      
      <div className="p-6 flex-1 space-y-6">
        <div className="space-y-2">
          <p className="text-[11px] font-black text-black uppercase leading-relaxed italic">
            "{analysis.explanation}"
          </p>
        </div>

        <div className="space-y-4 pt-4 border-t-2 border-black/5">
          <p className="text-[9px] font-black text-black/40 uppercase tracking-widest flex items-center gap-2">
            <Info size={12} /> Fatores Considerados
          </p>
          <div className="grid gap-2">
            {analysis.factors.map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                {f.positive ? (
                  <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                ) : (
                  <AlertCircle size={12} className="text-orange-500 shrink-0" />
                )}
                <span className="text-[10px] font-bold text-black uppercase tracking-tight">
                  {f.label}
                </span>
              </div>
            ))}
            {analysis.factors.length === 0 && (
              <p className="text-[9px] font-bold text-black/20 uppercase">Dados insuficientes para mapeamento de fatores.</p>
            )}
          </div>
        </div>
      </div>
      
      <div className="bg-[#f8f9fb] border-t-2 border-black p-3 text-center">
        <p className="text-[8px] font-black text-black/30 uppercase tracking-tighter">
          Estimativa automática baseada em ritos processuais • Sem valor de garantia
        </p>
      </div>
    </div>
  );
}

function BadgeLevel({ level, color }: { level: string; color: string }) {
  return (
    <span className={cn("px-3 py-1 text-[9px] font-black uppercase rounded-none border-2 border-black text-white shadow-[2px_2px_0px_#fff]", color)}>
      {level}
    </span>
  );
}
