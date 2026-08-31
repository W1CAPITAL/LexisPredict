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

const LEVEL: Record<AwardLevel, { label: string; Icon: typeof Trophy; border: string }> = {
  gold: { label: "1º LUGAR", Icon: Trophy, border: "border-amber-600/40" },
  silver: { label: "2º LUGAR", Icon: Medal, border: "border-slate-400/50" },
  bronze: { label: "3º LUGAR", Icon: AwardIcon, border: "border-orange-700/40" },
};

export function Awards({
  variant = "certificate",
  title = "CERTIFICADO",
  subtitle = "Análise de processos jurídicos",
  recipient,
  date,
  level = "gold",
  rank,
  className,
}: AwardsProps) {
  const resolved: AwardLevel =
    rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : level;
  const s = LEVEL[resolved];
  const Icon = s.Icon;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-sm border-2 bg-white text-slate-900 shadow-md",
        s.border,
        "p-6 animate-in fade-in duration-500",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-3 border border-amber-700/20 rounded-sm" />
      <div className="relative flex flex-col items-center text-center gap-2 py-2">
        <Icon className="h-8 w-8 text-amber-700" />
        <p className="text-[10px] font-semibold tracking-[0.25em] text-slate-500 uppercase">
          {s.label} · {title}
        </p>
        <h3 className="text-lg font-serif font-bold tracking-tight text-slate-900 break-words px-2 max-w-full">
          {recipient}
        </h3>
        <p className="text-sm text-slate-600 max-w-sm">{subtitle}</p>
        {date ? <p className="text-[11px] text-slate-500 uppercase tracking-wider">{date}</p> : null}
        {variant === "certificate" ? (
          <p className="mt-3 text-[10px] text-slate-400 border-t border-slate-200 pt-3 w-full">
            LexisPredict · certificado de reconhecimento operacional
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default Awards;
