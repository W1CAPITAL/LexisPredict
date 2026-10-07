"use client";

import React, { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Briefcase,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ListTodo,
  Menu,
  MessageCircle,
  RefreshCw,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/use-app-store";

type Step = {
  title: string;
  short: string;
  route?: string;
  icon: React.ReactNode;
  bullets: string[];
  actionLabel?: string;
};

const STEPS: Step[] = [
  {
    title: "1. Veja o que fazer hoje",
    short: "Comece por Tarefas. Não precisa conhecer o sistema inteiro.",
    route: "/tarefas",
    icon: <ListTodo className="h-5 w-5" />,
    bullets: [
      "Abra Tarefas e veja quem precisa de atendimento primeiro.",
      "Atenda os casos urgentes e registre o atendimento.",
      "Se não souber por onde começar, volte sempre aqui.",
    ],
    actionLabel: "Abrir Tarefas",
  },
  {
    title: "2. Ache qualquer processo",
    short: "Processos é a sua busca principal por cliente, CNJ e histórico.",
    route: "/cases",
    icon: <Briefcase className="h-5 w-5" />,
    bullets: [
      "Pesquise por nome do cliente ou número do processo.",
      "Abra o processo para ver histórico, retorno e dados principais.",
      "Evite procurar a mesma informação em várias telas.",
    ],
    actionLabel: "Abrir Processos",
  },
  {
    title: "3. Atualize quando precisar",
    short: "O botão Atualizar da barra inferior consulta DataJud + DJEN.",
    icon: <RefreshCw className="h-5 w-5" />,
    bullets: [
      "Use Atualizar quando quiser buscar novidades do tribunal.",
      "Não precisa deixar o scanner aberto o tempo todo.",
      "Depois, volte para Tarefas para trabalhar o que mudou.",
    ],
  },
  {
    title: "4. Fale com o cliente",
    short: "WhatsApp fica na barra inferior e também no Menu.",
    route: "/whatsapp",
    icon: <MessageCircle className="h-5 w-5" />,
    bullets: [
      "Conecte o WA.Auto uma vez.",
      "Abra o cliente e envie a mensagem pelo próprio Lexis.",
      "O histórico fica junto da operação, sem trocar de sistema.",
    ],
    actionLabel: "Abrir WhatsApp",
  },
  {
    title: "5. O resto fica no Menu",
    short: "Recursos avançados existem, mas você só usa quando precisar.",
    icon: <Menu className="h-5 w-5" />,
    bullets: [
      "Menu mostra agenda, documentos, relatórios, supervisão e outras ferramentas.",
      "A barra inferior fica simples de propósito: Início, Processos, Atualizar, WhatsApp e Menu.",
      "Se esquecer algo, abra Menu → Aprender o app em 3 minutos.",
    ],
  },
];

export function GuidedTour() {
  const router = useRouter();
  const pathname = usePathname();
  const {
    isTutorialActive,
    tutorialStep,
    setTutorialActive,
    setTutorialStep,
    setTutorialCompleted,
  } = useAppStore();

  const step = STEPS[Math.min(tutorialStep, STEPS.length - 1)];
  const progress = useMemo(
    () => Math.round(((tutorialStep + 1) / STEPS.length) * 100),
    [tutorialStep]
  );

  if (!isTutorialActive || !step) return null;

  const close = (completed = false) => {
    if (completed) setTutorialCompleted(true);
    setTutorialActive(false);
    setTutorialStep(0);
  };

  const next = () => {
    if (tutorialStep >= STEPS.length - 1) {
      close(true);
      return;
    }
    setTutorialStep(tutorialStep + 1);
  };

  const previous = () => {
    if (tutorialStep <= 0) return;
    setTutorialStep(tutorialStep - 1);
  };

  const openRoute = () => {
    if (!step.route) return;
    if (pathname !== step.route) router.push(step.route);
  };

  return (
    <div className="fixed inset-0 z-[160] flex items-end justify-center bg-black/45 p-3 backdrop-blur-[2px] sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Guia rápido — passo ${tutorialStep + 1} de ${STEPS.length}`}
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-start gap-3 border-b border-border bg-[#07182d] px-4 py-4 text-white sm:px-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1769ff]">
            {step.icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#9fc2e4]">
              Aprenda o Lexis em 3 minutos · {tutorialStep + 1}/{STEPS.length}
            </p>
            <h2 className="mt-1 text-lg font-black leading-tight">{step.title}</h2>
          </div>
          <button
            type="button"
            onClick={() => close(false)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
            aria-label="Fechar guia"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="h-1 bg-muted">
          <div
            className="h-full bg-[#1769ff] transition-[width] duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="p-4 sm:p-5">
          <p className="text-sm font-semibold leading-relaxed text-foreground">
            {step.short}
          </p>

          <div className="mt-4 space-y-2.5">
            {step.bullets.map((bullet) => (
              <div key={bullet} className="flex gap-2.5 rounded-xl bg-muted/45 p-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#1769ff]" />
                <p className="text-[13px] leading-relaxed text-foreground/85">{bullet}</p>
              </div>
            ))}
          </div>

          {step.route ? (
            <Button
              type="button"
              variant="outline"
              onClick={openRoute}
              className="mt-4 h-11 w-full rounded-xl font-bold"
            >
              {step.actionLabel || "Abrir tela"}
            </Button>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border bg-muted/30 px-4 py-3">
          <Button
            type="button"
            variant="ghost"
            onClick={previous}
            disabled={tutorialStep === 0}
            className="h-10"
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Voltar
          </Button>

          <Button type="button" onClick={next} className="h-10 px-4 font-bold">
            {tutorialStep === STEPS.length - 1 ? "Entendi" : "Próximo"}
            {tutorialStep === STEPS.length - 1 ? null : (
              <ChevronRight className="ml-1 h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
