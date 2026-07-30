
/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 */
import React from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  trendUp?: boolean;
  color?: 'primary' | 'accent' | 'destructive' | 'success' | 'warning';
}

export function StatCard({ title, value, icon, trend, trendUp, color = 'primary' }: StatCardProps) {
  const iconColors = {
    primary: "text-blue-600 bg-blue-50",
    accent: "text-cyan-600 bg-cyan-50",
    destructive: "text-red-600 bg-red-50",
    success: "text-emerald-600 bg-emerald-50",
    warning: "text-orange-600 bg-orange-50",
  };

  return (
    <div className="premium-card p-6 flex flex-col justify-between group">
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{title}</p>
          <h3 className="text-3xl font-black tracking-tighter text-foreground tabular-nums leading-none">
            {value}
          </h3>
        </div>
        <div className={cn("p-2.5 rounded-lg transition-transform group-hover:scale-110", iconColors[color])}>
          {React.cloneElement(icon as React.ReactElement, { size: 20 })}
        </div>
      </div>
      
      {trend && (
        <div className="flex items-center gap-2 mt-4">
          <div className={cn(
            "flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase",
            trendUp ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
          )}>
            {trendUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {trend}
          </div>
          <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-tight">dos ativos</span>
        </div>
      )}
    </div>
  );
}
