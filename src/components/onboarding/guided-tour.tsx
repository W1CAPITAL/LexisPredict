
"use client";

/**
 * @fileOverview Módulo de Onboarding Interativo v200.0 ELITE
 * Conduz o usuário por TODAS as abas estratégicas do LexisPredict.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import React, { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
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
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/use-app-store';
import { cn } from '@/lib/utils';

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
    content: "O centro nervoso da sua operação. Aqui você enxerga a saúde global do gabinete em tempo real.",
    icon: <Zap />,
    route: "/",
    porQue: "Centralizar a telemetria e o briefing neural diário.",
    rotina: "Verificar processos vencidos e ler o briefing da IA.",
    ganho: "Visão estratégica em menos de 30 segundos.",
    metrica: "Redução de 90% no tempo de triagem matinal.",
    tempo: "30 seg"
  },
  {
    title: "Fila de Atendimento",
    content: "Organização automática de contatos baseada em prazos e criticidade.",
    icon: <Target />,
    route: "/tarefas",
    porQue: "Garantir que nenhum cliente fique sem retorno nos prazos críticos.",
    rotina: "Executar ligações e WhatsApp da lista prioritária.",
    ganho: "Foco total na execução, sem perder tempo escolhendo quem ligar.",
    metrica: "Aumento de 40% na taxa de conversão de acordos.",
    tempo: "1 min"
  },
  {
    title: "Gestão de Carteira",
    content: "Repositório completo de processos com filtros dinâmicos e controle de banca.",
    icon: <Briefcase />,
    route: "/cases",
    porQue: "Eliminar planilhas isoladas e centralizar o histórico jurídico.",
    rotina: "Cadastrar novos casos e atualizar andamentos manuais.",
    ganho: "Localização instantânea de qualquer processo ou cliente.",
    metrica: "Capacidade de gerir até 10x mais casos por operador.",
    tempo: "2 min"
  },
  {
    title: "Diretório de Equipe",
    content: "Gestão de autoridade e níveis de acesso da sua banca.",
    icon: <Users />,
    route: "/team",
    porQue: "Controlar quem acessa o quê e visualizar o ranking de produtividade.",
    rotina: "Auditar sessões ativas e promover operadores de destaque.",
    ganho: "Segurança de dados (LGPD) e meritocracia operacional.",
    metrica: "Isolamento total de carteiras entre assistentes.",
    tempo: "1 min"
  },
  {
    title: "Auditoria 3D Elite",
    content: "Triagem neural profunda via DataJud com parecer estratégico automático.",
    icon: <FileSearch />,
    route: "/veredito",
    porQue: "Entender o status real de um processo sem ler páginas de andamentos.",
    rotina: "Consultar CNJs de processos complexos ou duvidosos.",
    ganho: "Parecer de gabinete pronto para enviar ao cliente.",
    metrica: "Economia de 15 minutos por consulta técnica.",
    tempo: "2 min"
  },
  {
    title: "Gerador de Procurações",
    content: "Automação de documentos 'Ad Judicia' com extração inteligente de dados.",
    icon: <FileText />,
    route: "/documents",
    porQue: "Reduzir erros de digitação e acelerar o onboarding de clientes.",
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
    title: "Peça de Substabelecimento",
    content: "Documentação técnica para peticionamento imediato.",
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
    content: "Comunicação estratégica com disparos via Evolution API.",
    icon: <MessageCircle />,
    route: "/whatsapp",
    porQue: "Falar com o cliente sem sair da plataforma, mantendo o histórico.",
    rotina: "Enviar despachos da IA e scripts prontos de atendimento.",
    ganho: "Centralização total da comunicação da empresa.",
    metrica: "Média de 100 atendimentos diários por operador.",
    tempo: "3 min"
  },
  {
    title: "Unidade de Ingestão",
    content: "Importação massiva de dados com correção automática de erros.",
    icon: <Upload />,
    route: "/import",
    porQue: "Migrar do Excel ou sistemas antigos para o LexisPredict.",
    rotina: "Subir dumps mensais ou novas carteiras de parceiros.",
    ganho: "Saneamento automático de datas e tribunais.",
    metrica: "Processamento de até 5.000 registros por minuto.",
    tempo: "5 min"
  },
  {
    title: "Livro de Evidências",
    content: "Registro de notas, fotos e andamentos estratégicos.",
    icon: <StickyNote />,
    route: "/notes",
    porQue: "Guardar fatos que não constam no processo judicial.",
    rotina: "Registrar feedbacks de clientes e anexar fotos de bens.",
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
    content: "Gráficos e indicadores de performance global.",
    icon: <BarChart3 />,
    route: "/analytics",
    porQue: "Identificar gargalos operacionais antes que virem problemas.",
    rotina: "Analisar volumetria por tribunal e resolutividade da banca.",
    ganho: "Decisões baseadas em dados, não em palpites.",
    metrica: "Dashboards prontos para reuniões de diretoria.",
    tempo: "2 min"
  },
  {
    title: "Algoritmo de Urgência",
    content: "Calibração dos pesos matemáticos de alerta.",
    icon: <ShieldAlert />,
    route: "/urgency",
    porQue: "Personalizar quando um processo deve ser considerado crítico.",
    rotina: "Ajustar os buffers de segurança do motor de prioridade.",
    ganho: "Sistema de alerta adaptado à velocidade da sua equipe.",
    metrica: "Configuração em milissegundos para toda a rede.",
    tempo: "1 min"
  },
  {
    title: "Omni Export Master",
    content: "Geração de Dossiê Omnipresente com todas as abas do app.",
    icon: <Printer />,
    route: "/master-export",
    porQue: "Entregar um relatório consolidado e irrefutável para investidores.",
    rotina: "Gerar fechamentos mensais da operação.",
    ganho: "Transparência total e status de autoridade máxima.",
    metrica: "Renderização global de 100% da infraestrutura.",
    tempo: "3 min"
  },
  {
    title: "Hardware Visual",
    content: "Personalização da atmosfera e interface do seu gabinete.",
    icon: <Palette />,
    route: "/settings",
    porQue: "Ajustar o ambiente de trabalho para máximo conforto visual.",
    rotina: "Trocar temas, wallpapers e níveis de desfoque (blur).",
    ganho: "Interface executiva exclusiva e agradável.",
    metrica: "100% de conformidade com contraste WCAG AAA.",
    tempo: "2 min"
  }
];

export function GuidedTour() {
  const router = useRouter();
  const { 
    isTutorialActive, 
    setTutorialActive, 
    setTutorialCompleted,
    tutorialStep,
    setTutorialStep
  } = useAppStore();

  // Hook useEffect movido para o topo
  useEffect(() => {
    if (isTutorialActive && TOUR_STEPS[tutorialStep]) {
      router.push(TOUR_STEPS[tutorialStep].route);
    }
  }, [tutorialStep, isTutorialActive, router]);

  // Hook useMemo movido para o topo para respeitar a ordem dos hooks
  const currentLevel = useMemo(() => {
    if (tutorialStep <= 3) return { label: "Nível 1", sub: "Primeiros Passos", color: "text-blue-500", bg: "bg-blue-500/10" };
    if (tutorialStep <= 12) return { label: "Nível 2", sub: "Automação Neural", color: "text-emerald-500", bg: "bg-emerald-500/10" };
    if (tutorialStep <= 14) return { label: "Nível 3", sub: "Produtividade", color: "text-orange-500", bg: "bg-orange-500/10" };
    return { label: "Nível 4", sub: "Especialista", color: "text-purple-500", bg: "bg-purple-500/10" };
  }, [tutorialStep]);

  // Retorno antecipado APÓS todos os hooks serem declarados
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
    router.push('/');
  };

  const step = TOUR_STEPS[tutorialStep];

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-6 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-300">
      <div className="w-full max-w-5xl bg-white border-4 border-black shadow-[30px_30px_0px_rgba(0,0,0,0.1)] relative overflow-hidden flex flex-col h-[85vh]">
        
        {/* Progress Bar */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gray-100 z-20">
          <div 
            className="h-full bg-primary transition-all duration-700 ease-out" 
            style={{ width: `${((tutorialStep + 1) / TOUR_STEPS.length) * 100}%` }}
          />
        </div>

        <button onClick={finishTour} className="absolute top-6 right-6 p-2 hover:bg-black hover:text-white transition-all z-30"><X size={24} /></button>

        <div className="flex flex-1 overflow-hidden">
          {/* Lado Esquerdo: Resumo Estratégico */}
          <div className="w-1/3 bg-[#f8f9fb] border-r-2 border-black p-10 flex flex-col justify-between overflow-y-auto">
             <div className="space-y-8">
                <div className={cn("px-4 py-2 w-fit rounded-none border-2 border-black font-black uppercase text-[10px] tracking-widest", currentLevel.bg, currentLevel.color)}>
                  {currentLevel.label} • {currentLevel.sub}
                </div>
                
                <div className="space-y-2">
                   <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40">Missão {tutorialStep + 1} de {TOUR_STEPS.length}</p>
                   <h2 className="text-3xl font-black uppercase tracking-tighter leading-none">{step.title}</h2>
                </div>

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
             </div>

             <div className="bg-white border-2 border-black p-4 mt-8">
                <p className="text-[8px] font-black uppercase opacity-40 mb-2">Métrica de Performance</p>
                <p className="text-[10px] font-black uppercase tracking-tight">{step.metrica}</p>
             </div>
          </div>

          {/* Lado Direito: Explicação e Navegação */}
          <div className="flex-1 flex flex-col bg-white overflow-y-auto">
             <div className="p-16 flex-1 space-y-12">
                <div className="flex items-center gap-8">
                   <div className="w-24 h-24 bg-black flex items-center justify-center text-white border-4 border-black shadow-[10px_10px_0px_#00D1FF] shrink-0">
                      {React.cloneElement(step.icon as React.ReactElement, { size: 48 })}
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

             {/* Footer Navegação */}
             <div className="p-10 bg-[#f8f9fb] border-t-2 border-black flex items-center justify-between">
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
          </div>
        </div>

        <div className="bg-black text-white p-4 flex items-center justify-center gap-3">
          <ShieldCheck size={16} className="text-primary" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em]">Ambiente Certificado de Treinamento • W1 Capital Elite v25.0</span>
        </div>
      </div>
    </div>
  );
}
