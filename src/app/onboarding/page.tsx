"use client";

/**
 * Página de treinamento em vídeo — alinhada ao produto atual
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import React, { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import {
  Play,
  ArrowLeft,
  Copyright,
  Bell,
  ListTodo,
  Scale,
  Printer,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function OnboardingVideoPage() {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div className="flex h-screen bg-background font-sans text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-y-auto overscroll-contain p-4 lg:p-8 flex flex-col">
        <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col min-w-0">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-4 min-w-0">
              <Link href="/">
                <Button
                  variant="ghost"
                  className="h-11 px-4 border-2 border-foreground/20 rounded-xl font-black uppercase text-[10px] hover:bg-foreground hover:text-background transition-all duration-200 shrink-0"
                >
                  <ArrowLeft size={16} className="mr-2" /> Gabinete
                </Button>
              </Link>
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter leading-none truncate">
                  Treinamento LexisPredict
                </h1>
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mt-1">
                  DataJud ∪ DJEN · Fila · Alertas · Dossiê
                </p>
              </div>
            </div>
          </div>

          <div className="bg-black border-2 border-black shadow-[12px_12px_0px_rgba(0,0,0,0.06)] aspect-video relative w-full max-w-full overflow-hidden rounded-sm">
            {isPlaying ? (
              <video
                controls
                autoPlay
                className="w-full h-full object-contain max-h-[min(70vh,720px)]"
                src="/Onboarding_LexisPredict.mp4"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-black/80 via-black/90 to-black p-6">
                <div className="text-white text-center mb-8 space-y-4 max-w-lg animate-in fade-in zoom-in-95 duration-500">
                  <div className="w-16 h-16 bg-primary/15 border border-primary/30 rounded-full flex items-center justify-center mx-auto mb-4 transition-transform duration-300 hover:scale-105">
                    <Play size={28} className="text-primary ml-0.5" />
                  </div>
                  <h2 className="text-3xl sm:text-5xl font-black uppercase tracking-tighter leading-none">
                    Operação de
                    <br />
                    carteira real
                  </h2>
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/40">
                    Vídeo de apoio · use também o Guia do Sistema na sidebar
                  </p>
                </div>
                <Button
                  onClick={() => setIsPlaying(true)}
                  className="h-14 px-10 bg-white text-black hover:bg-primary hover:text-primary-foreground transition-all duration-200 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg hover:shadow-xl active:scale-[0.98]"
                >
                  Iniciar vídeo
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-10 pb-16">
            <FeatureCard
              icon={<ListTodo className="text-primary" size={18} />}
              number="01"
              title="Fila unificada"
              desc="BA → baixa tribunal → mérito → andamento/DJEN → prazo. Trabalhe o topo."
            />
            <FeatureCard
              icon={<Bell className="text-primary" size={18} />}
              number="02"
              title="Alertas de mérito"
              desc="Sentença, audiência, cumprimento, B.A. — sem ruído de prazo genérico."
            />
            <FeatureCard
              icon={<Scale className="text-primary" size={18} />}
              number="03"
              title="Auditoria 3D"
              desc="DataJud + DJEN no mesmo fluxo. Flags só descem no atendimento humano."
            />
            <FeatureCard
              icon={<Printer className="text-primary" size={18} />}
              number="04"
              title="Dossiê Top 10"
              desc="Críticos por sinal, chance de encerramento e responsabilidade por perfil."
            />
          </div>
        </div>

        <footer className="h-10 border-t border-border/60 flex items-center justify-center gap-4 text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em] shrink-0">
          <span className="inline-flex items-center gap-2">
            <Copyright size={10} /> 2026 W1 Capital
          </span>
          <span className="hidden sm:inline">LexisPredict Enterprise</span>
        </footer>
      </main>
    </div>
  );
}

function FeatureCard({
  number,
  title,
  desc,
  icon,
}: {
  number: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "bg-card border border-border p-5 rounded-xl shadow-sm",
        "transition-all duration-300 ease-out",
        "hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30",
        "overflow-hidden min-w-0"
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-primary font-black text-xl tabular-nums">{number}</p>
        <div className="opacity-80">{icon}</div>
      </div>
      <h3 className="font-black uppercase text-xs mb-2 tracking-tight">{title}</h3>
      <p className="text-[11px] font-medium text-muted-foreground leading-relaxed">
        {desc}
      </p>
    </div>
  );
}
