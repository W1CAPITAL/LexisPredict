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
    <div className="lexis-metric group">
      <div className="flex justify-between items-start gap-3">
        <div className="space-y-2 min-w-0">
          <p className="lexis-metric-label truncate">{title}</p>
          <h3 className="lexis-metric-value truncate">
            {value}
          </h3>
        </div>
        <div className={cn(
          "p-2.5 rounded-xl transition-transform duration-200 group-hover:scale-105 shrink-0",
          iconColors[color]
        )}>
          {React.cloneElement(icon as React.ReactElement<any>, { size: 18, strokeWidth: 2.25 })}
        </div>
      </div>
      
      {trend && (
        <div className="flex items-center gap-2 mt-4">
          <div className={cn(
            "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold",
            trendUp
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
              : "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-400"
          )}>
            {trendUp ? <TrendingUp size={12} strokeWidth={2.5} /> : <TrendingDown size={12} strokeWidth={2.5} />}
            {trend}
          </div>
          <span className="text-[10px] font-medium text-muted-foreground">dos ativos</span>
        </div>
      )}
    </div>
  );
}
