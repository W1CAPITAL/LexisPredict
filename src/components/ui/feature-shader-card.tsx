"use client";

import React from "react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export type FeatureCardProps = {
  title: string;
  description: string;
  href?: string;
  icon?: React.ReactNode;
  tone?: "violet" | "teal" | "blue" | "slate";
  className?: string;
};

const tones: Record<string, string> = {
  violet: "from-violet-900/90 via-fuchsia-900/40 to-background border-violet-500/30",
  teal: "from-teal-900/90 via-emerald-900/40 to-background border-teal-500/30",
  blue: "from-blue-900/90 via-cyan-900/40 to-background border-blue-500/30",
  slate: "from-slate-900/90 via-slate-800/40 to-background border-slate-500/30",
};

export function FeatureShaderCard({
  title,
  description,
  href,
  icon,
  tone = "blue",
  className,
}: FeatureCardProps) {
  const body = (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border p-6 min-h-[180px]",
        "bg-gradient-to-br text-white shadow-lg transition-transform duration-300 hover:-translate-y-1",
        tones[tone],
        className
      )}
    >
      <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.25),transparent_50%)]" />
      <div className="relative z-10 space-y-3">
        {icon ? <div className="text-white/90">{icon}</div> : null}
        <h3 className="text-lg font-bold tracking-tight">{title}</h3>
        <p className="text-sm text-white/75 leading-relaxed">{description}</p>
        {href ? (
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-white/90 group-hover:gap-2 transition-all">
            Saiba mais <ArrowRight size={14} />
          </span>
        ) : null}
      </div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function FeatureShaderGrid({ className }: { className?: string }) {
  return (
    <div className={cn("grid sm:grid-cols-2 gap-4", className)}>
      <FeatureShaderCard
        tone="violet"
        title="Operação limpa"
        description="Painel, fila e processos com sinais DataJud/DJEN — sem ruído visual."
        href="/"
      />
      <FeatureShaderCard
        tone="teal"
        title="Performance de gabinete"
        description="Scanner em lote, auditoria unificada e respostas prontas para o cliente."
        href="/tarefas"
      />
    </div>
  );
}
