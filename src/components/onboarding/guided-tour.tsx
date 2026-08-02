"use client";

/**
 * @fileOverview Guia interativo LexisPredict — alinhado ao produto atual
 * (DataJud ∪ DJEN, fila unificada, alertas de mérito, dossiê Top 10, scanner híbrido)
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  X,
  ChevronRight,
  ChevronLeft,
  Zap,
  Target,
  Briefcase,
  Scale,
  Users,
  FileText,
  FileSignature,
  Files,
  MessageCircle,
  Upload,
  StickyNote,
  ScanLine,
  BarChart3,
  Printer,
  Sparkles,
  Clock,
  PlayCircle,
  ArrowLeft,
  Bell,
  Settings,
  ListTodo,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/use-app-store";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface TourStep {
  title: string;
  content: string;
  icon: React.ReactNode;
  route: string;
  porQue: string;
  rotina: string;
  ganho: string;
  metrica: string;
  tempo: string;
}

/** Passos alinhados às abas e fluxos reais do app (2026) */
const TOUR_STEPS: TourStep[] = [
  {
    title: "Dashboard — Gabinete Estratégico",
    content:
      "Telemetria unificada (DataJud ∪ DJEN): novidades pós-retorno, baixas no tribunal, indícios de B.A., fase de cumprimento e fila prioritária. Use como radar matinal — não como substituto dos autos.",
    icon: <Zap />,
    route: "/",
    porQue: "Ver em segundos o que exige ação humana hoje.",
    rotina:
      "Abrir o dia no Dashboard → checar B.A. e baixas → abrir Sequência Prioritária → ir para Tarefas ou Processos.",
    ganho: "Triagem matinal em menos de um minuto.",
    metrica: "Menos tempo escolhendo o que fazer; mais tempo atendendo.",
    tempo: "30 seg",
  },
  {
    title: "Fila de Tarefas",
    content:
      "Prioridade operacional: Busca e Apreensão → baixa/trânsito no tribunal → eventos de mérito (sentença, audiência) → novo andamento/DJEN → prazo e tempo sem retorno. Cards com resumo limpo (sem HTML do diário).",
    icon: <ListTodo />,
    route: "/tarefas",
    porQue: "Garantir ordem de contato correta sob volume.",
    rotina:
      "Trabalhar o topo da fila; marcar contato; registrar próximo retorno na carteira do cliente quando aplicável.",
    ganho: "Foco no crítico antes do genérico.",
    metrica: "Menos clientes críticos sem retorno no mesmo dia.",
    tempo: "1–2 min",
  },
  {
    title: "Processos (Carteira)",
    content:
      "Carteira completa com sinal de capa (Tribunal / Diário / Híbrido), badges de novidade, B.A. e encerrado. Auditoria 3D pontual, scripts de resposta e rascunho via IA opcional. Link Abrir no D.O. quando houver publicação.",
    icon: <Briefcase />,
    route: "/cases",
    porQue: "Gestão do processo individual com evidência do tribunal e do diário.",
    rotina:
      "Buscar CNJ → Auditoria 3D → ler cronologia → sugerir resposta → registrar atendimento (zera alertas só após contato humano).",
    ganho: "Histórico e despacho no mesmo fluxo.",
    metrica: "Zero ‘novidade’ esquecida sem triagem.",
    tempo: "2 min",
  },
  {
    title: "Centro de Alertas de Mérito",
    content:
      "Só eventos operacionais relevantes: B.A., sentença, audiência, cumprimento, custas/partes, nova movimentação com fato concreto. Não lista prazo vencido genérico — isso fica em Tarefas/Dashboard.",
    icon: <Bell />,
    route: "/notificacoes",
    porQue: "Separar mérito jurídico de fila de prazo.",
    rotina: "Filtrar B.A. / Mérito / Audiência / Execução → Gerir caso.",
    ganho: "Menos ruído; mais decisão.",
    metrica: "Alertas legíveis com título + detalhe (não só ‘há novidade’).",
    tempo: "1 min",
  },
  {
    title: "Scanner DataJud ∪ DJEN",
    content:
      "Painel do scanner (botão na sidebar): modos Tribunal, Diário ou Híbrido. Lote local com logs e retomada; nuvem sob demanda. Flags de alerta não somem no rescan — só no atendimento. DataJud ≠ PJe; confira críticos no tribunal.",
    icon: <ShieldAlert />,
    route: "/",
    porQue: "Atualizar a carteira em volume sem planilha manual.",
    rotina:
      "Escolher modo Híbrido → varredura local ou ciclo de nuvem → acompanhar feed de logs → tratar novidades em Tarefas/Alertas.",
    ganho: "Telemetria alinhada à operação real.",
    metrica: "Progresso e logs visíveis por CNJ na sessão local.",
    tempo: "conforme carteira",
  },
  {
    title: "Equipe e KPI",
    content:
      "Cargos e escopo por empresa. Supervisores veem ranking e carteira ampliada; operadores focam na própria fila. Performance para supervisão — não só cadastro de usuários.",
    icon: <Users />,
    route: "/team",
    porQue: "Governança multi-operador com isolamento multi-tenant.",
    rotina: "Auditar metas e distribuição de carga.",
    ganho: "Visibilidade de quem executa o quê.",
    metrica: "KPI de pessoas + processos.",
    tempo: "1 min",
  },
  {
    title: "Auditoria / Veredito",
    content:
      "Consulta profunda de CNJ com apoio de análise. Use como triagem técnica; a verdade final continua nos autos e no sistema do tribunal.",
    icon: <Scale />,
    route: "/veredito",
    porQue: "Parecer rápido sem substituir a leitura dos autos.",
    rotina: "Consultar CNJs sensíveis e registrar orientação no atendimento.",
    ganho: "Base objetiva para despacho ao cliente.",
    metrica: "Menos tempo em andamento genérico.",
    tempo: "2 min",
  },
  {
    title: "Documentos — Procuração",
    content:
      "Geração de procuração com extração assistida de contrato/lead. Revise sempre os dados antes do PDF final.",
    icon: <FileText />,
    route: "/documents",
    porQue: "Acelerar onboarding documental com revisão humana.",
    rotina: "Subir material → revisar campos → gerar PDF.",
    ganho: "Peça padronizada em minutos.",
    metrica: "Menos retrabalho de digitação.",
    tempo: "1–2 min",
  },
  {
    title: "Habilitação e Substabelecimentos",
    content:
      "Habilitação, substabelecimento (com/sem reserva), peça de comunicação ao juízo. Modelos alinhados à rotina de banca de volume.",
    icon: <FileSignature />,
    route: "/habilitacao-peca",
    porQue: "Padronizar ingresso e troca de patronos.",
    rotina: "Escolher o fluxo (habilitação / subst. / peça) e gerar o conjunto.",
    ganho: "Conformidade e velocidade na troca de poderes.",
    metrica: "Menos glosa por formalidade.",
    tempo: "1 min",
  },
  {
    title: "WhatsApp e despacho",
    content:
      "Comunicação com o cliente a partir da carteira. Scripts determinísticos primeiro; rascunho via IA opcional, sempre com validação humana. Não cite marca da empresa em mensagens ao cliente se a política interna proibir.",
    icon: <MessageCircle />,
    route: "/whatsapp",
    porQue: "Fechar o ciclo: sinal do tribunal → texto de atendimento.",
    rotina: "Usar sugestão na fila/processos → revisar → enviar pelo canal configurado.",
    ganho: "Resposta alinhada ao andamento capturado.",
    metrica: "Menos texto genérico sem fato do processo.",
    tempo: "2–3 min",
  },
  {
    title: "Importação CSV",
    content:
      "Ingestão de planilhas legadas com normalização de datas, encoding e dedupe por protocolo. Tribunal inferido pelo CNJ quando possível.",
    icon: <Upload />,
    route: "/import",
    porQue: "Migrar volume sem recriar processo a processo.",
    rotina: "Subir CSV → revisar erros → confirmar carga.",
    ganho: "Carteira operacional a partir do legado.",
    metrica: "Milhares de linhas em lote controlado.",
    tempo: "5 min",
  },
  {
    title: "Notas e evidências",
    content:
      "Registro interno (fatos de atendimento, mídias, observações). Pode alimentar briefing — não confundir com andamento oficial do tribunal.",
    icon: <StickyNote />,
    route: "/notes",
    porQue: "Memória do gabinete além do que consta no DataJud/DJEN.",
    rotina: "Anotar pós-contato e anexar evidências relevantes.",
    ganho: "Contexto para o próximo operador.",
    metrica: "Menos perda de informação entre turnos.",
    tempo: "1–2 min",
  },
  {
    title: "OCR",
    content:
      "Apoio à leitura de documentos escaneados. Texto extraído exige revisão antes de uso em peça ou cadastro.",
    icon: <ScanLine />,
    route: "/tools/ocr",
    porQue: "Reduzir digitação de documentos em imagem.",
    rotina: "Enviar scan → revisar texto → usar no fluxo documental.",
    ganho: "Menos retrabalho manual.",
    metrica: "Triagem mais rápida de papel digitalizado.",
    tempo: "2 min",
  },
  {
    title: "Analytics",
    content:
      "Visão agregada de volume e performance. Complementa o Dashboard operacional com recortes de análise.",
    icon: <BarChart3 />,
    route: "/analytics",
    porQue: "Enxergar gargalos por unidade/período.",
    rotina: "Revisar tendências com a supervisão.",
    ganho: "Decisão com base em série, não só no dia.",
    metrica: "BI operacional da carteira.",
    tempo: "2 min",
  },
  {
    title: "Dossiê / Relatório",
    content:
      "Relatório imprimível: KPIs, Top 10 por sinal de capa, chance de encerramento, cumprimento/procedente/improcedente, auditoria de responsabilidade (operador vs supervisor) e ranking quando o perfil for master.",
    icon: <Printer />,
    route: "/report",
    porQue: "Fechamento executivo e rastreio de pendências por dono.",
    rotina: "Gerar dossiê → imprimir/PDF → agir nos links Gerir.",
    ganho: "Reunião e despacho com a mesma fonte de verdade.",
    metrica: "Listas acionáveis, não só capa visual.",
    tempo: "2 min",
  },
  {
    title: "Configurações e base de conhecimento",
    content:
      "Preferências, tema e (quando habilitado) base de conhecimento para o motor de despacho. A IA é apoio: scripts locais primeiro; provedores externos só como complemento.",
    icon: <Settings />,
    route: "/settings",
    porQue: "Calibrar ambiente e material de apoio à redação.",
    rotina: "Ajustar tema/prazos; enviar PDFs de treino só com conteúdo autorizado.",
    ganho: "Operação estável e despacho mais contextual.",
    metrica: "Menos dependência de texto genérico.",
    tempo: "2 min",
  },
];

export function GuidedTour() {
  const router = useRouter();
  const pathname = usePathname();
  const {
    isTutorialActive,
    setTutorialActive,
    setTutorialCompleted,
    tutorialStep,
    setTutorialStep,
  } = useAppStore();

  const [showVideo, setShowVideo] = useState(false);

  const currentLevel = useMemo(() => {
    if (tutorialStep <= 3)
      return {
        label: "Nível 1",
        sub: "Radar e Fila",
        color: "text-blue-500",
        bg: "bg-blue-500/10",
      };
    if (tutorialStep <= 8)
      return {
        label: "Nível 2",
        sub: "Carteira e Mérito",
        color: "text-emerald-500",
        bg: "bg-emerald-500/10",
      };
    if (tutorialStep <= 12)
      return {
        label: "Nível 3",
        sub: "Documentos e Contato",
        color: "text-orange-500",
        bg: "bg-orange-500/10",
      };
    return {
      label: "Nível 4",
      sub: "Governança",
      color: "text-purple-500",
      bg: "bg-purple-500/10",
    };
  }, [tutorialStep]);

  useEffect(() => {
    const currentStepRoute = TOUR_STEPS[tutorialStep]?.route;
    if (
      isTutorialActive &&
      currentStepRoute &&
      !showVideo &&
      pathname !== currentStepRoute
    ) {
      router.push(currentStepRoute);
    }
  }, [tutorialStep, isTutorialActive, router, showVideo, pathname]);

  if (!isTutorialActive) return null;

  const handleNext = () => {
    if (tutorialStep < TOUR_STEPS.length - 1) {
      setTutorialStep(tutorialStep + 1);
    } else {
      finishTour();
    }
  };

  const handlePrev = () => {
    if (tutorialStep > 0) setTutorialStep(tutorialStep - 1);
  };

  const finishTour = () => {
    setTutorialActive(false);
    setTutorialCompleted(true);
    setTutorialStep(0);
    setShowVideo(false);
    router.push("/");
  };

  const step = TOUR_STEPS[tutorialStep];
  if (!step) return null;

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-3 sm:p-6 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-300 overflow-hidden">
      <div className="w-full max-w-5xl max-h-[min(90vh,900px)] bg-white border-2 sm:border-4 border-black shadow-[12px_12px_0px_rgba(0,0,0,0.08)] relative overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gray-100 z-20">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{
              width: `${((tutorialStep + 1) / TOUR_STEPS.length) * 100}%`,
            }}
          />
        </div>

        <button
          type="button"
          onClick={finishTour}
          className="absolute top-4 right-4 p-2 hover:bg-black hover:text-white transition-all z-30 rounded-md"
          aria-label="Fechar guia"
        >
          <X size={22} />
        </button>

        <div className="p-4 sm:p-8 pb-0 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 sm:mb-6 pr-10">
            <div className="flex items-center gap-3 min-w-0">
              <Link href="/">
                <Button
                  variant="ghost"
                  className="h-10 px-3 border-2 border-black rounded-none font-black uppercase text-[10px] hover:bg-black hover:text-white transition-all shrink-0"
                >
                  <ArrowLeft size={14} className="mr-2" /> Gabinete
                </Button>
              </Link>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tighter leading-none truncate">
                  Guia LexisPredict
                </h1>
                <p className="text-[9px] font-black uppercase text-black/40 tracking-widest mt-1 truncate">
                  Operação real · DataJud ∪ DJEN · Fila · Dossiê
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden flex-col lg:flex-row">
          <div className="lg:w-1/3 bg-[#f8f9fb] lg:border-r-2 border-black p-5 sm:p-8 flex flex-col justify-between overflow-y-auto overscroll-contain min-h-0 max-h-[40vh] lg:max-h-none">
            <div className="space-y-6">
              <div
                className={cn(
                  "px-3 py-1.5 w-fit border-2 border-black font-black uppercase text-[10px] tracking-widest",
                  currentLevel.bg,
                  currentLevel.color
                )}
              >
                {currentLevel.label} · {currentLevel.sub}
              </div>

              {!showVideo ? (
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">
                    Passo {tutorialStep + 1} de {TOUR_STEPS.length}
                  </p>
                  <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter leading-tight">
                    {step.title}
                  </h2>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">
                    Vídeo
                  </p>
                  <h2 className="text-2xl font-black uppercase tracking-tighter leading-tight">
                    Treinamento em vídeo
                  </h2>
                </div>
              )}

              {!showVideo && (
                <div className="space-y-4 pt-2">
                  <div className="space-y-1">
                    <p className="text-[9px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                      <Sparkles size={12} /> Por que existe?
                    </p>
                    <p className="text-xs font-bold text-black/70 leading-relaxed">
                      {step.porQue}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-black uppercase text-blue-600 tracking-widest flex items-center gap-2">
                      <Clock size={12} /> Rotina
                    </p>
                    <p className="text-xs font-bold text-black/70 leading-relaxed">
                      {step.rotina}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-black uppercase text-emerald-600 tracking-widest flex items-center gap-2">
                      <Target size={12} /> Ganho
                    </p>
                    <p className="text-xs font-bold text-black/70 leading-relaxed">
                      {step.ganho}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3 mt-6 shrink-0">
              {!showVideo && (
                <div className="bg-white border-2 border-black p-3">
                  <p className="text-[8px] font-black uppercase opacity-40 mb-1">
                    Métrica
                  </p>
                  <p className="text-[10px] font-black uppercase tracking-tight leading-snug">
                    {step.metrica}
                  </p>
                </div>
              )}
              {showVideo ? (
                <Button
                  onClick={() => setShowVideo(false)}
                  variant="outline"
                  className="w-full h-11 border-2 border-black rounded-none bg-black text-white hover:bg-primary hover:text-black font-black uppercase text-[9px] tracking-widest transition-all"
                >
                  <ArrowLeft size={16} className="mr-2" /> Voltar ao guia
                </Button>
              ) : (
                <Button
                  onClick={() => setShowVideo(true)}
                  variant="outline"
                  className="w-full h-11 border-2 border-black rounded-none bg-white text-black hover:bg-black hover:text-white font-black uppercase text-[9px] tracking-widest transition-all"
                >
                  <PlayCircle size={16} className="mr-2" /> Vídeo de apoio
                </Button>
              )}
            </div>
          </div>

          <div className="flex-1 flex flex-col bg-white min-h-0 overflow-hidden">
            {showVideo ? (
              <div className="flex-1 bg-black flex items-center justify-center p-3 min-h-0">
                <video
                  controls
                  autoPlay
                  className="max-w-full max-h-full object-contain border border-white/10"
                  src="/Onboarding_LexisPredict.mp4"
                />
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto overscroll-contain min-h-0">
                <div className="p-6 sm:p-12 space-y-8">
                  <div className="flex flex-col sm:flex-row items-start gap-6">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-black flex items-center justify-center text-white border-2 border-black shadow-[6px_6px_0px_hsl(var(--primary))] shrink-0 transition-transform duration-300 hover:scale-[1.02]">
                      {React.cloneElement(
                        step.icon as React.ReactElement<{ size?: number }>,
                        { size: 36 }
                      )}
                    </div>
                    <p className="text-base sm:text-lg font-bold leading-relaxed tracking-tight text-black/80">
                      {step.content}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                    <div className="p-5 border-2 border-black bg-[#f3f2f2] transition-shadow duration-200 hover:shadow-md">
                      <p className="text-[9px] font-black uppercase opacity-40 mb-2">
                        Limite honesto
                      </p>
                      <p className="text-[11px] font-bold leading-relaxed text-black/70">
                        DataJud e DJEN são triagem. Casos críticos e prazos
                        fatais exigem conferência no sistema do tribunal (PJe /
                        e-SAJ).
                      </p>
                    </div>
                    <div className="p-5 border-2 border-black bg-black text-white shadow-[6px_6px_0px_hsl(var(--primary))]">
                      <p className="text-[9px] font-black uppercase text-primary tracking-widest mb-2">
                        Tempo estimado
                      </p>
                      <p className="text-2xl font-black">{step.tempo}</p>
                      <p className="text-[8px] font-bold uppercase opacity-60">
                        Leitura + primeiro uso
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!showVideo && (
              <div className="p-4 sm:p-6 bg-[#f8f9fb] border-t-2 border-black flex flex-wrap items-center justify-between gap-3 shrink-0">
                <Button
                  variant="ghost"
                  onClick={handlePrev}
                  disabled={tutorialStep === 0}
                  className="h-11 px-4 font-black uppercase text-[10px] border-2 border-transparent hover:border-black rounded-none transition-all"
                >
                  <ChevronLeft size={16} className="mr-1" /> Anterior
                </Button>

                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={finishTour}
                    className="h-11 px-4 font-black uppercase text-[10px] text-black/40 hover:text-black rounded-none"
                  >
                    Encerrar
                  </Button>
                  <Button
                    onClick={handleNext}
                    className="h-11 px-5 bg-black text-white hover:bg-primary hover:text-black font-black uppercase text-[10px] rounded-none transition-all"
                  >
                    {tutorialStep === TOUR_STEPS.length - 1
                      ? "Concluir"
                      : "Próximo"}
                    <ChevronRight size={16} className="ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
