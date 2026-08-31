"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Medal, Trophy, Award as AwardIcon } from "lucide-react";

export type AwardLevel = "gold" | "silver" | "bronze";

export type AwardsProps = {
  variant?: "award" | "certificate";
  title?: string;
  subtitle?: string;
  recipient: string;
  date?: string;
  level?: AwardLevel;
  rank?: 1 | 2 | 3;
  className?: string;
};

const LEVEL_STYLE: Record<
  AwardLevel,
  { ring: string; bg: string; badge: string; label: string; Icon: typeof Trophy }
> = {
  gold: {
    ring: "from-amber-300 via-yellow-400 to-amber-600",
    bg: "from-amber-50 to-yellow-100 dark:from-amber-950/40 dark:to-yellow-900/20",
    badge: "bg-gradient-to-br from-amber-400 to-yellow-600 text-white",
    label: "1º LUGAR",
    Icon: Trophy,
  },
  silver: {
    ring: "from-slate-200 via-slate-300 to-slate-500",
    bg: "from-slate-50 to-slate-200 dark:from-slate-900/40 dark:to-slate-800/30",
    badge: "bg-gradient-to-br from-slate-300 to-slate-500 text-slate-900",
    label: "2º LUGAR",
    Icon: Medal,
  },
  bronze: {
    ring: "from-orange-300 via-amber-600 to-orange-800",
    bg: "from-orange-50 to-amber-100 dark:from-orange-950/30 dark:to-amber-900/20",
    badge: "bg-gradient-to-br from-orange-400 to-amber-700 text-white",
    label: "3º LUGAR",
    Icon: AwardIcon,
  },
};

export function Awards({
  variant = "award",
  title = "WINNER",
  subtitle = "Melhor atendente · análise de processos jurídicos",
  recipient,
  date,
  level = "gold",
  rank,
  className,
}: AwardsProps) {
  const resolved: AwardLevel =
    rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : level;
  const s = LEVEL_STYLE[resolved];
  const Icon = s.Icon;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/20 p-6 shadow-xl",
        "bg-gradient-to-br backdrop-blur-xl",
        s.bg,
        "animate-in fade-in zoom-in-95 duration-500",
        className
      )}
    >
      <div
        className={cn(
          "absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-30 blur-2xl bg-gradient-to-br",
          s.ring
        )}
      />
      <div className="relative flex flex-col items-center text-center gap-3">
        <div
          className={cn(
            "flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg",
            s.badge
          )}
        >
          <Icon className="h-8 w-8" />
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">
          {s.label} · {title}
        </p>
        <h3 className="text-xl font-black tracking-tight text-foreground">{recipient}</h3>
        <p className="text-sm text-muted-foreground max-w-sm">{subtitle}</p>
        {date ? (
          <p className="text-[11px] font-bold uppercase tracking-widest text-foreground/70">{date}</p>
        ) : null}
        {variant === "certificate" ? (
          <p className="mt-2 text-[10px] text-muted-foreground border-t border-border/50 pt-3 w-full">
            Certificado LexisPredict · análise de processos jurídicos do mês
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default Awards;
