"use client";
import { FeatureShaderGrid } from "@/components/ui/feature-shader-card";

/**
 * Página de treinamento — vídeo + atalho para o Guia interativo atualizado
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import React, { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import {
  Play,
  ArrowLeft,
  Copyright,
  ListTodo,
  Scale,
  FileSpreadsheet,
  ScanLine,
  BookOpen,
  Briefcase,
  FileSignature,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/use-app-store";

export default function OnboardingVideoPage() {
  const [isPlaying, setIsPlaying] = useState(false);
  const { setTutorialActive, setTutorialStep } = useAppStore();

  const startGuide = () => {
    setTutorialStep(0);
    setTutorialActive(true);
  };

  return (
    <div className="flex h-screen bg-background font-sans text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-y-auto overscroll-contain lexis-surface p-4 lg:p-8 flex flex-col">
        <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col min-w-0">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-4 min-w-0">
              <Link href="/">
                <Button
                  variant="outline"
                  className="h-11 px-4 rounded-xl font-semibold uppercase text-[10px] shrink-0"
                >
                  <ArrowLeft size={16} className="mr-2" /> Gabinete
                </Button>
              </Link>
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight leading-none truncate">
                  Treinamento LexisPredict
                </h1>
                <p className="text-[11px] font-semibold uppercase text-muted-foreground tracking-wider mt-1.5">
                  Guia atual · DataJud + DJEN · Fila · Processos · Veredito · Excel
                </p>
              </div>
            </div>
            <Button
              onClick={startGuide}
              className="h-11 px-5 rounded-xl font-semibold uppercase text-[11px] gap-2 shrink-0"
            >
              <BookOpen size={16} /> Iniciar guia interativo
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="bg-foreground text-background aspect-video relative w-full max-w-full">
              {isPlaying ? (
                <video
                  controls
                  autoPlay
                  className="w-full h-full object-contain max-h-[min(70vh,720px)]"
                  src="/Onboarding_LexisPredict.mp4"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-foreground via-foreground to-foreground/90 p-6 text-center gap-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
                    Vídeo de apoio
                  </p>
                  <p className="text-sm text-background/70 max-w-md leading-relaxed">
                    O vídeo pode ficar atrás da interface. O{" "}
                    <strong className="text-background">guia interativo</strong> segue o
                    menu atual (Painel, Fila, Processos, Veredito, Documentos, Scanner…).
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    <Button
                      onClick={() => setIsPlaying(true)}
                      className="h-12 px-6 rounded-xl bg-primary text-primary-foreground font-semibold uppercase text-[11px] gap-2"
                    >
                      <Play size={16} fill="currentColor" /> Assistir vídeo
                    </Button>
                    <Button
                      onClick={startGuide}
                      variant="outline"
                      className="h-12 px-6 rounded-xl border-background/30 text-background hover:bg-background/10 font-semibold uppercase text-[11px] gap-2"
                    >
                      <BookOpen size={16} /> Preferir guia escrito
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-10 pb-8">
            <FeatureCard
              icon={<Zap className="text-primary" size={18} />}
              number="01"
              title="Painel"
              desc="Radar matinal: vencidos, andamentos, baixas e risco. Triagem, não autos."
            />
            <FeatureCard
              icon={<ListTodo className="text-primary" size={18} />}
              number="02"
              title="Fila de contato"
              desc="Prioridade de atendimento + resposta pronta ao cliente (copiar)."
            />
            <FeatureCard
              icon={<Briefcase className="text-primary" size={18} />}
              number="03"
              title="Processos"
              desc="Filtros, Auditoria 3D e Excel operacional (sem IDs internos)."
            />
            <FeatureCard
              icon={<Scale className="text-primary" size={18} />}
              number="04"
              title="Veredito"
              desc="CNJ / CPF / nome · DataJud + DJEN · polos ativo/passivo."
            />
            <FeatureCard
              icon={<ScanLine className="text-primary" size={18} />}
              number="05"
              title="Scanner"
              desc="Lote DataJud e/ou DJEN com progresso que retoma se recarregar."
            />
            <FeatureCard
              icon={<FileSignature className="text-primary" size={18} />}
              number="06"
              title="Documentos"
              desc="Procuração, habilitação e substabelecimentos com PDF."
            />
            <FeatureCard
              icon={<FileSpreadsheet className="text-primary" size={18} />}
              number="07"
              title="Export Excel"
              desc="Planilha estilo relatório de gabinete, só da sua empresa."
            />
            <FeatureCard
              icon={<BookOpen className="text-primary" size={18} />}
              number="08"
              title="Este guia"
              desc="11 passos com rotina, dicas e limites honestos do CNJ."
            />
          </div>
        </div>

        <footer className="h-10 border-t border-border/60 flex items-center justify-center gap-4 text-[10px] text-muted-foreground font-medium uppercase tracking-[0.18em] shrink-0">
          <span className="inline-flex items-center gap-2">
            <Copyright size={10} /> 2026 W1 Capital
          </span>
          <span className="hidden sm:inline">LexisPredict Enterprise</span>
        </footer>
      
        <div className="px-6 pb-10 max-w-4xl mx-auto w-full">
          <FeatureShaderGrid />
        </div>
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
        "bg-card border border-border/80 p-5 rounded-xl",
        "transition-all duration-200 ease-out",
        "hover:shadow-md hover:-translate-y-0.5 hover:border-primary/25",
        "overflow-hidden min-w-0"
      )}
      style={{ boxShadow: "var(--shadow-card, 0 1px 2px rgba(15,23,42,.04))" }}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-primary font-bold text-xl tabular-nums">{number}</p>
        <div className="opacity-90">{icon}</div>
      </div>
      <h3 className="font-bold uppercase text-xs mb-2 tracking-tight">{title}</h3>
      <p className="text-[12px] font-medium text-muted-foreground leading-relaxed">
        {desc}
      </p>
    </div>
  );
}
