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
    primary: "text-primary bg-primary/10 ring-1 ring-primary/15",
    accent: "text-sky-600 bg-sky-50 ring-1 ring-sky-100 dark:bg-sky-500/10 dark:text-sky-400 dark:ring-sky-500/20",
    destructive: "text-destructive bg-destructive/10 ring-1 ring-destructive/15",
    success: "text-emerald-700 bg-emerald-50 ring-1 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20",
    warning: "text-amber-700 bg-amber-50 ring-1 ring-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20",
  };

  return (
    <div className="lexis-metric group min-h-[118px]">
      <div className="flex items-center gap-4">
        <div className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
          iconColors[color]
        )}>
          {React.cloneElement(icon as React.ReactElement<any>, { size: 22, strokeWidth: 2.15 })}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-[#19345c] truncate">{title}</p>
          <h3 className="mt-1 text-[30px] font-black leading-none tracking-[-.035em] text-[#102447] tabular-nums">
            {value}
          </h3>
        </div>
      </div>

      {trend && (
        <div className="mt-3 flex items-center gap-2 pl-16">
          <span className={cn(
            "inline-flex items-center gap-1 text-[12px] font-black",
            trendUp ? "text-emerald-600" : "text-red-500"
          )}>
            {trendUp ? <TrendingUp size={13} strokeWidth={2.5} /> : <TrendingDown size={13} strokeWidth={2.5} />}
            {trend}
          </span>
          <span className="text-[10px] font-medium text-[#6d7f9b]">vs. período anterior</span>
        </div>
      )}
    </div>
  );
}
