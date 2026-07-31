"use client";

/**
 * @fileOverview Módulo de Onboarding Interativo v250.0 ELITE
 * Conduz o usuário por TODAS as abas estratégicas com suporte a VÍDEO INTEGRADO.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { 
  X, 
  ChevronRight, 
  ChevronLeft, 
  Zap, 
  ShieldCheck, 
  Target, 
  Briefcase, 
  FileSearch, 
  Palette,
  Users,
  FileText,
  FileSignature,
  Repeat,
  FileStack,
  MessageCircle,
  Upload,
  StickyNote,
  ScanText,
  BarChart3,
  ShieldAlert,
  Printer,
  Sparkles,
  Clock,
  PlayCircle,
  ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/use-app-store';
import { cn } from '@/lib/utils';
import Link from 'next/link';

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

const TOUR_STEPS: TourStep[] = [
  {
    title: "Mission Control (Dashboard)",
    content: "O centro nervoso da sua operação. Aqui você enxerga a telemetria forense e os cards de prognóstico de encerramento em tempo real.",
    icon: <Zap />,
    route: "/",
    porQue: "Centralizar a telemetria e o briefing neural diário.",
    rotina: "Verificar andamentos não atendidos e analisar chances de baixa (Alta/Muito Alta).",
    ganho: "Visão estratégica em menos de 30 segundos.",
    metrica: "Redução de 90% no tempo de triagem matinal.",
    tempo: "30 seg"
  },
  {
    title: "Fila de Atendimento",
    content: "Organização automática de contatos baseada em prioridade DataJud (Prazos + Carência).",
    icon: <Target />,
    route: "/tarefas",
    porQue: "Garantir que nenhum cliente fique sem retorno nos prazos críticos.",
    rotina: "Executar o topo da fila, que prioriza indícios de Busca e Apreensão e Baixas.",
    ganho: "Foco total na execução, sem perder tempo escolhendo quem ligar.",
    metrica: "Aumento de 40% na taxa de conversão de acordos.",
    tempo: "1 min"
  },
  {
    title: "Gestão de Carteira",
    content: "Repositório completo com scanner em lote (Resume vs Full) e consulta pontual 1 a 1.",
    icon: <Briefcase />,
    route: "/cases",
    porQue: "Centralizar o histórico jurídico e monitorar badges de alerta.",
    rotina: "Usar o scanner em lote para varredura geral e o botão de andamento na linha para consultas robustas.",
    ganho: "Localização instantânea. 'Tempo esgotado' no lote? Use a consulta pontual.",
    metrica: "Zero processos esquecidos sem monitoramento ativo.",
    tempo: "2 min"
  },
  {
    title: "Diretório de Equipe",
    content: "Gestão de autoridade e Ranking Operacional. Supervisores veem tudo; operadores veem sua própria meta.",
    icon: <Users />,
    route: "/team",
    porQue: "Controlar níveis de acesso (Management) e visualizar o Ranking/KPI da banca.",
    rotina: "Auditar o desempenho líquido e produtividade por cargo.",
    ganho: "Segurança de dados e meritocracia baseada em Score real.",
    metrica: "Isolamento total de carteiras entre assistentes.",
    tempo: "1 min"
  },
  {
    title: "Auditoria 3D Elite",
    content: "Triagem neural profunda. O DataJud pode diferir do PJe; use como apoio, não como substituto dos autos.",
    icon: <FileSearch />,
    route: "/veredito",
    porQue: "Entender o status real sem ler páginas de andamentos.",
    rotina: "Consultar CNJs para gerar pareceres técnicos de gabinete.",
    ganho: "Estratégia operacional pronta para despachar ao cliente.",
    metrica: "Economia de 15 minutos por consulta técnica.",
    tempo: "2 min"
  },
  {
    title: "Gerador de Procurações",
    content: "Automação 'Ad Judicia' com extração inteligente de dados via IA.",
    icon: <FileText />,
    route: "/documents",
    porQue: "Reduzir erros de digitação e acelerar o onboarding.",
    rotina: "Subir o contrato/lead e gerar o PDF selado.",
    ganho: "Peça pronta em segundos, formatada e profissional.",
    metrica: "Redução de 80% no tempo de preenchimento manual.",
    tempo: "1.5 min"
  },
  {
    title: "Módulo de Habilitação",
    content: "Peças de habilitação combinadas com procuração em um clique.",
    icon: <FileSignature />,
    route: "/habilitacao-peca",
    porQue: "Padronizar as petições de ingresso nos autos.",
    rotina: "Gerar conjunto documental para novos patrocínios.",
    ganho: "Conformidade técnica total com as exigências dos tribunais.",
    metrica: "Zero glosa por erro de qualificação do patrono.",
    tempo: "1 min"
  },
  {
    title: "Substabelecimento Digital",
    content: "Transferência de poderes segura e padronizada.",
    icon: <Repeat />,
    route: "/substabelecimento",
    porQue: "Agilizar a troca de advogados na carteira sem riscos.",
    rotina: "Documentar a saída ou entrada de novos patronos.",
    ganho: "Segurança jurídica na transmissão de poderes.",
    metrica: "Processamento de substabelecimentos em massa.",
    tempo: "1 min"
  },
  {
    title: "Subst. Sem Reserva",
    content: "Instrumentos rápidos com opção de exclusão de contracapa conforme Art. 272 CPC.",
    icon: <Repeat />,
    route: "/substabelecimento-simples",
    porQue: "Transferir poderes rapidamente sem necessidade de peça petição.",
    rotina: "Escolher entre o Modelo Padrão ou o Modelo CPC para exclusão da banca anterior.",
    ganho: "Flexibilidade na gestão de correspondentes.",
    metrica: "Agilidade total na transição de banca.",
    tempo: "1 min"
  },
  {
    title: "Peça de Substabelecimento",
    content: "Documentação técnica para peticionamento imediato e atualização de intimações.",
    icon: <FileStack />,
    route: "/substabelecimento-peca",
    porQue: "Garantir a atualização do nome do advogado na contracapa dos autos.",
    rotina: "Gerar petição de comunicação ao juízo.",
    ganho: "Evita nulidades por falta de intimação do novo advogado.",
    metrica: "Conformidade com o Art. 272 do CPC.",
    tempo: "1 min"
  },
  {
    title: "Terminal WhatsApp",
    content: "Comunicação estratégica com disparos via Evolution API e histórico real.",
    icon: <MessageCircle />,
    route: "/whatsapp",
    porQue: "Falar com o cliente mantendo a centralização dos dados.",
    rotina: "Enviar despachos da IA e scripts prontos de atendimento.",
    ganho: "Centralização total da comunicação da empresa.",
    metrica: "Média de 100 atendimentos diários por operador.",
    tempo: "3 min"
  },
  {
    title: "Unidade de Ingestão",
    content: "Importação massiva de dados com correção automática de encoding e datas.",
    icon: <Upload />,
    route: "/import",
    porQue: "Migrar do Excel ou sistemas antigos para o LexisPredict.",
    rotina: "Subir dumps mensais ou novas carteiras de parceiros.",
    ganho: "Saneamento automático de bases 'sujas'.",
    metrica: "Processamento de até 5.000 registros por minuto.",
    tempo: "5 min"
  },
  {
    title: "Livro de Evidências",
    content: "Registro de notas, fotos e andamentos estratégicos com auditoria neural.",
    icon: <StickyNote />,
    route: "/notes",
    porQue: "Guardar fatos que não constam no processo judicial.",
    rotina: "Anexar evidências de mídias e feedbacks de clientes.",
    ganho: "Memória institucional inabalável.",
    metrica: "IA analisa pontos fortes e riscos das suas notas.",
    tempo: "2 min"
  },
  {
    title: "Motor de OCR Soberano",
    content: "Transcrição visual de scans e fotos em texto editável.",
    icon: <ScanText />,
    route: "/tools/ocr",
    porQue: "Eliminar a redigitação manual de documentos físicos.",
    rotina: "Converter PDFs de imagem em texto para a triagem neural.",
    ganho: "Privacidade total (processamento local no navegador).",
    metrica: "Reconhecimento de 300 DPI com 99% de precisão.",
    tempo: "2 min"
  },
  {
    title: "Business Intelligence",
    content: "Gráficos de volumetria e performance global da carteira.",
    icon: <BarChart3 />,
    route: "/analytics",
    porQue: "Identificar gargalos operacionais antes que virem problemas.",
    rotina: "Analisar resolutividade por unidade e advogado.",
    ganho: "Decisões baseadas em dados (BI).",
    metrica: "Dashboards prontos para auditoria executiva.",
    tempo: "2 min"
  },
  {
    title: "Dossiê Operacional (Relatório)",
    content: "Relatório consolidado com telemetria forense, evidências e prognósticos.",
    icon: <Printer />,
    route: "/report",
    porQue: "Gerar um documento de integridade total para impressão ou exportação.",
    rotina: "Gerar fechamentos periódicos com visão 360 da carteira.",
    ganho: "Relatório profissional completo em um clique.",
    metrica: "Transparência total para investidores e clientes.",
    tempo: "2 min"
  },
  {
    title: "Hardware Visual",
    content: "Personalização da atmosfera e calibração do Algoritmo de Urgência.",
    icon: <Palette />,
    route: "/settings",
    porQue: "Ajustar o ambiente de trabalho e as regras de prioridade do motor.",
    rotina: "Trocar temas e ajustar buffers de segurança de prazos.",
    ganho: "Interface exclusiva e alerta adaptado à sua equipe.",
    metrica: "100% de conformidade com conforto visual.",
    tempo: "2 min"
  }
];

export function GuidedTour() {
  const router = useRouter();
  const pathname = usePathname();
  const { 
    isTutorialActive, 
    setTutorialActive, 
    setTutorialCompleted,
    tutorialStep,
    setTutorialStep
  } = useAppStore();

  const [showVideo, setShowVideo] = useState(false);

  const currentLevel = useMemo(() => {
    if (tutorialStep <= 4) return { label: "Nível 1", sub: "Primeiros Passos", color: "text-blue-500", bg: "bg-blue-500/10" };
    if (tutorialStep <= 12) return { label: "Nível 2", sub: "Automação Neural", color: "text-emerald-500", bg: "bg-emerald-500/10" };
    if (tutorialStep <= 15) return { label: "Nível 3", sub: "Alta Performance", color: "text-orange-500", bg: "bg-orange-500/10" };
    return { label: "Nível 4", sub: "Especialista Master", color: "text-purple-500", bg: "bg-purple-500/10" };
  }, [tutorialStep]);

  useEffect(() => {
    const currentStepRoute = TOUR_STEPS[tutorialStep]?.route;
    if (isTutorialActive && currentStepRoute && !showVideo && pathname !== currentStepRoute) {
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
    if (tutorialStep > 0) {
      setTutorialStep(tutorialStep - 1);
    }
  };

  const finishTour = () => {
    setTutorialActive(false);
    setTutorialCompleted(true);
    setTutorialStep(0);
    setShowVideo(false);
    router.push('/');
  };

  const step = TOUR_STEPS[tutorialStep];

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-300">
      <div className="w-full max-w-5xl bg-white border-4 border-black shadow-[30px_30px_0px_rgba(0,0,0,0.1)] relative overflow-hidden flex flex-col h-[85vh]">
        
        <div className="absolute top-0 left-0 right-0 h-2 bg-gray-100 z-20">
          <div 
            className="h-full bg-primary transition-all duration-700 ease-out" 
            style={{ width: `${((tutorialStep + 1) / TOUR_STEPS.length) * 100}%` }}
          />
        </div>

        <button onClick={finishTour} className="absolute top-6 right-6 p-2 hover:bg-black hover:text-white transition-all z-30"><X size={24} /></button>

        <div className="p-8 pb-0">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" className="h-11 px-4 border-2 border-black rounded-none font-black uppercase text-[10px] hover:bg-black hover:text-white transition-all">
                  <ArrowLeft size={16} className="mr-2" /> Gabinete
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl font-black uppercase tracking-tighter leading-none">Mestre em LexisPredict</h1>
                <p className="text-[10px] font-black uppercase text-black/40 tracking-widest mt-1">Formação Estratégica de Operador Elite</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-1/3 bg-[#f8f9fb] border-r-2 border-black p-10 flex flex-col justify-between overflow-y-auto">
             <div className="space-y-8">
                <div className={cn("px-4 py-2 w-fit rounded-none border-2 border-black font-black uppercase text-[10px] tracking-widest", currentLevel.bg, currentLevel.color)}>
                  {currentLevel.label} • {currentLevel.sub}
                </div>
                
                {!showVideo ? (
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40">Missão {tutorialStep + 1} de {TOUR_STEPS.length}</p>
                    <h2 className="text-3xl font-black uppercase tracking-tighter leading-none">{step.title}</h2>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40">Vídeo Aula</p>
                    <h2 className="text-3xl font-black uppercase tracking-tighter leading-none">Treinamento Master</h2>
                  </div>
                )}

                {!showVideo && (
                  <div className="space-y-6 pt-4">
                     <div className="space-y-1">
                        <p className="text-[9px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><Sparkles size={12}/> Por que existe?</p>
                        <p className="text-xs font-bold uppercase text-black/70 leading-relaxed italic">"{step.porQue}"</p>
                     </div>
                     <div className="space-y-1">
                        <p className="text-[9px] font-black uppercase text-blue-600 tracking-widest flex items-center gap-2"><Clock size={12}/> Rotina Diária (8h)</p>
                        <p className="text-xs font-bold uppercase text-black/70 leading-relaxed">{step.rotina}</p>
                     </div>
                     <div className="space-y-1">
                        <p className="text-[9px] font-black uppercase text-emerald-600 tracking-widest flex items-center gap-2"><Target size={12}/> Ganho Real</p>
                        <p className="text-xs font-bold uppercase text-black/70 leading-relaxed">{step.ganho}</p>
                     </div>
                  </div>
                )}
             </div>

             <div className="space-y-4 mt-8">
                {!showVideo && (
                  <div className="bg-white border-2 border-black p-4">
                    <p className="text-[8px] font-black uppercase opacity-40 mb-2">Métrica de Performance</p>
                    <p className="text-[10px] font-black uppercase tracking-tight">{step.metrica}</p>
                  </div>
                )}

                {showVideo ? (
                  <Button 
                    onClick={() => setShowVideo(false)}
                    variant="outline"
                    className="w-full h-12 border-2 border-black rounded-none bg-black text-white hover:bg-primary hover:text-black font-black uppercase text-[9px] tracking-widest transition-all shadow-[4px_4px_0px_#00D1FF] hover:shadow-none"
                  >
                    <ArrowLeft size={16} className="mr-2" /> Voltar ao Guia
                  </Button>
                ) : (
                  <Button 
                    onClick={() => setShowVideo(true)}
                    variant="outline"
                    className="w-full h-12 border-2 border-black rounded-none bg-white text-black hover:bg-black hover:text-white font-black uppercase text-[9px] tracking-widest transition-all shadow-[4px_4px_0px_#000] hover:shadow-none"
                  >
                    <PlayCircle size={16} className="mr-2" /> Assistir Treinamento
                  </Button>
                )}
             </div>
          </div>

          <div className="flex-1 flex flex-col bg-white overflow-hidden">
             {showVideo ? (
               <div className="flex-1 bg-black flex items-center justify-center p-4">
                  <video 
                    controls 
                    autoPlay 
                    className="max-w-full max-h-full border-2 border-white/10 shadow-2xl"
                    src="/Onboarding_LexisPredict.mp4"
                  />
               </div>
             ) : (
               <div className="flex-1 overflow-y-auto">
                 <div className="p-16 space-y-12">
                    <div className="flex items-center gap-8">
                       <div className="w-24 h-24 bg-black flex items-center justify-center text-white border-4 border-black shadow-[10px_10px_0px_#00D1FF] shrink-0">
                          {React.cloneElement(step.icon as React.ReactElement<any>, { size: 48 })}
                       </div>
                       <p className="text-xl font-bold uppercase leading-relaxed tracking-tight text-black/80">
                          {step.content}
                       </p>
                    </div>

                    <div className="grid grid-cols-2 gap-8 pt-10">
                       <div className="p-6 border-2 border-black bg-[#f3f2f2]">
                          <p className="text-[9px] font-black uppercase opacity-40 mb-2">💡 Você Sabia?</p>
                          <p className="text-[10px] font-bold uppercase leading-relaxed">
                            Atrasar o acompanhamento desta tela pode gerar perda de prazo e responsabilidade civil direta. O LexisPredict mitiga esse risco automaticamente.
                          </p>
                       </div>
                       <div className="p-6 border-2 border-black bg-black text-white shadow-[6px_6px_0px_#00D1FF]">
                          <p className="text-[9px] font-black uppercase text-primary tracking-widest mb-2">⏱ Tempo Estimado</p>
                          <p className="text-2xl font-black">{step.tempo}</p>
                          <p className="text-[8px] font-bold uppercase opacity-60">Para leitura e execução inicial</p>
                       </div>
                    </div>
                 </div>
               </div>
             )}

             {!showVideo && (
               <div className="p-10 bg-[#f8f9fb] border-t-2 border-black flex items-center justify-between shrink-0">
                  <Button 
                    variant="ghost" 
                    onClick={handlePrev} 
                    disabled={tutorialStep === 0}
                    className="h-12 px-6 font-black uppercase text-[10px] border-2 border-transparent hover:border-black rounded-none transition-all"
                  >
                    <ChevronLeft size={18} className="mr-2" /> Aba Anterior
                  </Button>
                  
                  <div className="flex gap-4">
                    <Button 
                      variant="ghost" 
                      onClick={finishTour}
                      className="h-12 px-6 font-black uppercase text-[10px] text-black/40 hover:text-black rounded-none"
                    >
                      Encerrar Tutorial
                    </Button>
                    <Button 
                      onClick={handleNext}
                      className="h-14 px-12 bg-black text-white hover:bg-primary hover:text-black font-black uppercase text-[11px] tracking-widest rounded-none shadow-[8px_8px_0px_#00D1FF] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
                    >
                      {tutorialStep === TOUR_STEPS.length - 1 ? "Finalizar Formação" : "Próxima Missão"} <ChevronRight size={18} className="ml-2" />
                    </Button>
                  </div>
               </div>
             )}
          </div>
        </div>

        <div className="bg-black text-white p-4 flex items-center justify-center gap-3 shrink-0">
          <ShieldCheck size={16} className="text-primary" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em]">Ambiente Certificado de Treinamento • W1 Capital Elite v25.0</span>
        </div>
      </div>
    </div>
  );
}
