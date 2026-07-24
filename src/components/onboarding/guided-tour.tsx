
"use client";

/**
 * @fileOverview Módulo de Onboarding Estratégico v500.0 ELITE
 * Treinamento Prático: Ensina a rotina diária e o valor estratégico.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import React, { useEffect, useState } from 'react';
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
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/use-app-store';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface TourStep {
  title: string;
  level: string;
  levelNum: number;
  why: string;
  routine: string[];
  benefits: string[];
  metrics?: string;
  didYouKnow?: string;
  nextMission: string;
  time: string;
  icon: React.ReactNode;
  route: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    title: "Mission Control (Dashboard)",
    level: "Nível 1: Primeiros Passos",
    levelNum: 1,
    why: "O Dashboard é o cérebro do seu gabinete. Sem ele, você perderia horas abrindo planilhas e sites de tribunais para saber quem precisa de atenção.",
    routine: ["Verificar processos vencidos", "Conferir o Índice de Risco Global", "Ler o Briefing Neural da IA"],
    benefits: ["Prioridade automática de casos", "Visão global em 5 segundos", "Identificação imediata de gargalos"],
    metrics: "Com o Dashboard, a triagem matinal é reduzida de 40 minutos para 30 segundos.",
    didYouKnow: "O Índice de Risco é calculado em tempo real com base na inércia dos prazos.",
    nextMission: "Agora, vamos ver onde esses dados nascem.",
    time: "30 segundos",
    icon: <Zap className="text-primary" />,
    route: "/"
  },
  {
    title: "Gestão de Carteira (Processos)",
    level: "Nível 1: Primeiros Passos",
    levelNum: 1,
    why: "Aqui é o coração da operação. É nesta tela que a equipe centraliza todos os clientes, eliminando de vez as planilhas soltas e o risco de perda de informações.",
    routine: ["Cadastrar novos clientes", "Atualizar andamentos manuais", "Localizar processos via CNJ"],
    benefits: ["Histórico unificado", "Pesquisa instantânea", "Isolamento por advogado"],
    didYouKnow: "Um processo sem próxima data de retorno é um processo esquecido. Nunca deixe este campo vazio.",
    nextMission: "Veja como o sistema organiza o seu dia de trabalho.",
    time: "2 minutos",
    icon: <Briefcase className="text-blue-500" />,
    route: "/cases"
  },
  {
    title: "Fila de Atendimento (Tarefas)",
    level: "Nível 1: Primeiros Passos",
    levelNum: 1,
    why: "O sistema já filtrou quem precisa ser ouvido hoje. O foco aqui é produtividade máxima no contato com o cliente.",
    routine: ["Realizar contatos da meta diária", "Registrar feedbacks de atendimento", "Bater a meta de contatos (Default: 25)"],
    benefits: ["Fim da dúvida 'quem eu ligo agora?'", "Gestão de meta de produtividade", "Sincronia com o WhatsApp"],
    metrics: "Operadores que usam a Fila de Tarefas aumentam em 3x o volume de atendimentos diários.",
    nextMission: "Vamos ver quem está no comando com você.",
    time: "1 minuto",
    icon: <Target className="text-red-500" />,
    route: "/tarefas"
  },
  {
    title: "Diretório de Equipe",
    level: "Nível 1: Primeiros Passos",
    levelNum: 1,
    why: "Controle de autoridade e segurança. Garanta que cada membro tenha acesso apenas ao que sua função exige.",
    routine: ["Verificar membros ativos", "Auditar cargos e permissões"],
    benefits: ["Segurança de dados (P0)", "Ranking de autoridade", "Gestão multi-usuário"],
    nextMission: "Nível 2: Vamos entrar na era da Automação.",
    time: "1 minuto",
    icon: <Users className="text-purple-500" />,
    route: "/team"
  },
  {
    title: "Auditoria 3D (Veredito)",
    level: "Nível 2: Automação",
    levelNum: 2,
    why: "A triagem manual no DataJud é lenta. A Auditoria 3D usa IA para ler o histórico e dar um parecer técnico pronto.",
    routine: ["Inserir CNJ de casos críticos", "Analisar probabilidade de encerramento", "Copiar mensagens prontas para o cliente"],
    benefits: ["Resumo jurídico instantâneo", "Elimina o 'juridiquês' para o cliente", "Identifica riscos processuais ocultos"],
    metrics: "A IA reduz o tempo de análise técnica em até 90%.",
    didYouKnow: "O sistema faz fallback automático entre Grok e DeepSeek para garantir resposta.",
    nextMission: "Chega de redigitar dados de contratos.",
    time: "2 minutos",
    icon: <FileSearch className="text-emerald-500" />,
    route: "/veredito"
  },
  {
    title: "Gerador de Procurações",
    level: "Nível 2: Automação",
    levelNum: 2,
    why: "Gerar procurações manualmente causa erros de digitação e toma tempo. A IA extrai os dados do contrato por você.",
    routine: ["Upload de contrato/PDF", "Conferir extração neural", "Selar e Exportar"],
    benefits: ["Redução de erro humano", "Padronização da banca", "Velocidade na habilitação"],
    metrics: "Preenchimento de dados reduzido de 10 minutos para 15 segundos.",
    nextMission: "Também automatizamos a entrada nos autos.",
    time: "2 minutos",
    icon: <FileText className="text-amber-500" />,
    route: "/documents"
  },
  {
    title: "Módulo de Habilitação",
    level: "Nível 2: Automação",
    levelNum: 2,
    why: "Unifica o pedido de habilitação e a procuração em uma única peça técnica otimizada.",
    routine: ["Gerar peça de entrada nos autos"],
    benefits: ["Protocolo agilizado", "Conformidade com o CPC"],
    nextMission: "Precisa passar o bastão? Use o próximo módulo.",
    time: "1 minuto",
    icon: <FileSignature className="text-orange-500" />,
    route: "/habilitacao-peca"
  },
  {
    title: "Substabelecimento Digital",
    level: "Nível 2: Automação",
    levelNum: 2,
    why: "Garante que a transmissão de poderes seja feita sem erros de nomes ou OABs.",
    routine: ["Transferir casos entre advogados"],
    benefits: ["Segurança jurídica na troca", "Peças sem reserva de poderes"],
    nextMission: "Não esqueça de comunicar o juiz da troca.",
    time: "1 minuto",
    icon: <Repeat className="text-indigo-500" />,
    route: "/substabelecimento"
  },
  {
    title: "Peça de Substabelecimento",
    level: "Nível 2: Automação",
    levelNum: 2,
    why: "Específica para peticionamento, garantindo que o novo patrono receba as intimações corretamente.",
    routine: ["Gerar petição de troca de patrono"],
    didYouKnow: "Esquecer de peticionar o substabelecimento pode causar nulidade por falta de intimação.",
    nextMission: "Vamos falar com o cliente de forma profissional.",
    time: "1 minuto",
    icon: <FileStack className="text-rose-500" />,
    route: "/substabelecimento-peca"
  },
  {
    title: "Terminal WhatsApp Hub",
    level: "Nível 3: Produtividade",
    levelNum: 3,
    why: "Centraliza a comunicação. Você envia mensagens profissionais sem precisar digitar tudo do zero.",
    routine: ["Enviar despachos da IA", "Usar Scripts de Gabinete", "Sincronizar histórico real"],
    benefits: ["Histórico salvo no banco", "Mensagens padronizadas", "Envio via API Evolution"],
    nextMission: "Hora de importar seu legado para o sistema.",
    time: "2 minutos",
    icon: <MessageCircle className="text-emerald-600" />,
    route: "/whatsapp"
  },
  {
    title: "Unidade de Ingestão (Importação)",
    level: "Nível 2: Automação",
    levelNum: 2,
    why: "Mover dados de Excel para o sistema costuma ser um pesadelo. Nossa unidade corrige tudo automaticamente.",
    routine: ["Subir planilhas de processos", "Colar Dumps de bancos"],
    benefits: ["Saneamento automático de datas", "Deduplicação de protocolos", "Identificação de Tribunais"],
    tips: "Certifique-se de que seu CSV tenha as colunas: Cliente, Protocolo e Status.",
    nextMission: "Capture evidências do seu trabalho.",
    time: "5 minutos",
    icon: <Upload className="text-blue-400" />,
    route: "/import"
  },
  {
    title: "Livro de Evidências (Notas)",
    level: "Nível 2: Automação",
    levelNum: 2,
    why: "Notas de papel somem. Aqui você guarda fotos, áudios transcritos e andamentos estratégicos para toda a equipe.",
    routine: ["Registrar andamentos críticos", "Anexar prints de decisões"],
    benefits: ["Auditoria IA de evidências", "Memória institucional", "Busca global de notas"],
    nextMission: "Transforme fotos de processos em texto editável.",
    time: "2 minutos",
    icon: <StickyNote className="text-yellow-500" />,
    route: "/notes"
  },
  {
    title: "Motor de OCR Soberano",
    level: "Nível 2: Automação",
    levelNum: 2,
    why: "Evita o trabalho braçal de redigitar documentos que só existem em foto ou scan.",
    routine: ["Processar fotos de petições", "Transcrever contratos digitalizados"],
    benefits: ["Processamento local (Privacidade)", "Busca em documentos físicos"],
    metrics: "Transforma 50 páginas de PDF em texto em menos de 1 minuto.",
    nextMission: "Nível 3: Decisões baseadas em dados.",
    time: "2 minutos",
    icon: <ScanText className="text-cyan-500" />,
    route: "/tools/ocr"
  },
  {
    title: "Business Intelligence (Analytics)",
    level: "Nível 3: Produtividade",
    levelNum: 3,
    why: "Gestores de elite não trabalham no escuro. Veja a performance da banca e a concentração por tribunal.",
    routine: ["Identificar gargalos por tribunal", "Verificar produtividade da banca"],
    benefits: ["Visão executiva real", "Apoio para decisões de escala"],
    didYouKnow: "Tribunais com alta taxa de 'Vencidos' podem indicar instabilidade sistêmica ou falta de braço na banca.",
    nextMission: "Quem manda no tempo dos alertas?",
    time: "1 minuto",
    icon: <BarChart3 className="text-pink-500" />,
    route: "/analytics"
  },
  {
    title: "Algoritmo de Urgência",
    level: "Nível 3: Produtividade",
    levelNum: 3,
    why: "Cada empresa tem um ritmo. Aqui você define quando um prazo deve começar a 'gritar' na tela.",
    routine: ["Calibrar limites de Alerta e Crítico"],
    benefits: ["Personalização do motor neural", "Controle de compliance"],
    nextMission: "Nível 4: Especialista e Master Report.",
    time: "1 minuto",
    icon: <ShieldAlert className="text-red-600" />,
    route: "/urgency"
  },
  {
    title: "Omni Export Master",
    level: "Nível 4: Especialista",
    levelNum: 4,
    why: "O Dossiê Supremo. Uma única função para 'congelar' o estado de todas as abas em um relatório PDF épico.",
    routine: ["Gerar Dossiê Semanal para diretoria"],
    benefits: ["Transparência total", "Documento para auditoria externa"],
    nextMission: "Por fim, deixe o gabinete com a sua cara.",
    time: "3 minutos",
    icon: <Printer className="text-slate-800" />,
    route: "/master-export"
  },
  {
    title: "Hardware Visual & Configurações",
    level: "Nível 4: Especialista",
    levelNum: 4,
    why: "O ambiente de trabalho impacta no foco. Personalize a atmosfera, cores e blurs do seu sistema.",
    routine: ["Trocar atmosfera (Presets)", "Ajustar opacidades", "Subir Wallpaper da empresa"],
    benefits: ["Redução de cansaço visual", "Identidade visual corporativa"],
    nextMission: "Treinamento Concluído. Você agora é um Operador Elite.",
    time: "2 minutos",
    icon: <Palette className="text-violet-500" />,
    route: "/settings"
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

  const [checklist, setChecklist] = useState<boolean[]>(new Array(4).fill(false));

  useEffect(() => {
    if (isTutorialActive && TOUR_STEPS[tutorialStep]) {
      router.push(TOUR_STEPS[tutorialStep].route);
      setChecklist(new Array(4).fill(false));
    }
  }, [tutorialStep, isTutorialActive, router]);

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
  const allChecked = checklist.every(c => c);

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-6 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-300">
      <div className="w-full max-w-2xl bg-white border-4 border-black shadow-[20px_20px_0px_#000] relative overflow-hidden flex flex-col max-h-[90vh]">
        {/* Barra de Progresso Real */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gray-100">
          <div 
            className="h-full bg-primary transition-all duration-700 ease-out" 
            style={{ width: `${((tutorialStep + 1) / TOUR_STEPS.length) * 100}%` }}
          />
        </div>

        <button 
          onClick={finishTour}
          className="absolute top-6 right-6 p-2 hover:bg-black hover:text-white transition-all z-10"
        >
          <X size={24} />
        </button>

        <ScrollArea className="flex-1">
          <div className="p-8 lg:p-12 space-y-8">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-black flex items-center justify-center text-white border-2 border-black shadow-lg shrink-0">
                {React.cloneElement(step.icon as React.ReactElement, { size: 32 })}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-3 mb-1">
                   <Badge className="bg-primary text-primary-foreground text-[8px] font-black uppercase rounded-none">{step.level}</Badge>
                   <span className="text-[10px] font-black text-black/40 uppercase tracking-widest">Módulo {tutorialStep + 1}/{TOUR_STEPS.length}</span>
                </div>
                <h2 className="text-2xl font-black uppercase tracking-tighter leading-tight truncate">{step.title}</h2>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
               <div className="lg:col-span-7 space-y-8">
                  <section className="space-y-3">
                    <h3 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-black/40"><Info size={12}/> Por que existe?</h3>
                    <p className="text-[13px] font-bold leading-relaxed text-black/80">{step.why}</p>
                  </section>

                  <section className="space-y-4 bg-secondary/20 p-6 border-l-4 border-primary">
                    <h3 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-primary"><Clock size={12}/> Rotina (8h da Manhã)</h3>
                    <ul className="space-y-2">
                       {step.routine.map((r, i) => (
                         <li key={i} className="text-[11px] font-black uppercase flex gap-3 text-black/70">
                           <span className="text-primary">0{i+1}.</span> {r}
                         </li>
                       ))}
                    </ul>
                  </section>

                  <section className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-emerald-600"><TrendingUp size={12}/> Ganhos Reais</h3>
                    <div className="flex flex-wrap gap-2">
                       {step.benefits.map((b, i) => (
                         <Badge key={i} variant="outline" className="border-black border-2 text-[8px] font-black uppercase rounded-none bg-white">{b}</Badge>
                       ))}
                    </div>
                  </section>
               </div>

               <div className="lg:col-span-5 space-y-6">
                  {step.metrics && (
                    <div className="p-5 bg-black text-primary border-2 border-black space-y-2">
                       <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-60">Impacto Mensurável</p>
                       <p className="text-[11px] font-black uppercase leading-tight italic">"{step.metrics}"</p>
                    </div>
                  )}

                  {step.didYouKnow && (
                    <div className="p-5 bg-blue-50 border-2 border-blue-600 space-y-2">
                       <p className="text-[9px] font-black text-blue-600 uppercase tracking-[0.2em]">Você Sabia?</p>
                       <p className="text-[10px] font-bold text-blue-900 leading-relaxed uppercase">{step.didYouKnow}</p>
                    </div>
                  )}

                  <div className="p-6 border-2 border-black space-y-4 bg-gray-50">
                    <h3 className="text-[9px] font-black uppercase tracking-widest text-black/40">Checklist de Missão</h3>
                    <div className="space-y-3">
                       <CheckItem label="Entendi para que serve" checked={checklist[0]} onChange={() => { const n = [...checklist]; n[0] = !n[0]; setChecklist(n); }} />
                       <CheckItem label="Sei quando usar" checked={checklist[1]} onChange={() => { const n = [...checklist]; n[1] = !n[1]; setChecklist(n); }} />
                       <CheckItem label="Sei onde fica no menu" checked={checklist[2]} onChange={() => { const n = [...checklist]; n[2] = !n[2]; setChecklist(n); }} />
                       <CheckItem label="Sei o resultado esperado" checked={checklist[3]} onChange={() => { const n = [...checklist]; n[3] = !n[3]; setChecklist(n); }} />
                    </div>
                  </div>
               </div>
            </div>

            <div className="pt-8 border-t-2 border-black/5 flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                 <Button variant="ghost" onClick={handlePrev} disabled={tutorialStep === 0} className="h-12 px-6 font-black uppercase text-[10px] border-2 border-transparent hover:border-black rounded-none disabled:opacity-20"><ChevronLeft size={18} className="mr-2" /> Anterior</Button>
                 <span className="text-[9px] font-black uppercase text-black/40">⏱ Tempo de Estudo: {step.time}</span>
              </div>
              
              <div className="flex gap-4 w-full sm:w-auto">
                <Button variant="ghost" onClick={finishTour} className="flex-1 sm:flex-none h-12 px-6 font-black uppercase text-[10px] text-black/40 hover:text-black rounded-none">Sair do Treino</Button>
                <Button 
                  onClick={handleNext}
                  disabled={!allChecked}
                  className={cn(
                    "flex-1 sm:flex-none h-12 px-10 font-black uppercase text-[11px] tracking-widest rounded-none shadow-[6px_6px_0px_#000] hover:shadow-none transition-all border-2 border-black",
                    allChecked ? "bg-black text-white hover:bg-primary hover:text-black hover:border-primary" : "bg-gray-100 text-black/20 pointer-events-none"
                  )}
                >
                  {tutorialStep === TOUR_STEPS.length - 1 ? "Finalizar Formação" : "Próxima Missão"} <ChevronRight size={18} className="ml-2" />
                </Button>
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="bg-black text-white p-3 flex items-center justify-center gap-3">
          <ShieldCheck size={14} className="text-primary" />
          <span className="text-[9px] font-black uppercase tracking-[0.4em]">{step.nextMission}</span>
        </div>
      </div>
    </div>
  );
}

function CheckItem({ label, checked, onChange }: { label: string, checked: boolean, onChange: () => void }) {
  return (
    <button onClick={onChange} className="flex items-center gap-3 w-full text-left group">
      <div className={cn("w-4 h-4 border-2 border-black flex items-center justify-center transition-all", checked ? "bg-emerald-500 border-emerald-500" : "bg-white")}>
        {checked && <CheckCircle2 size={10} className="text-white" />}
      </div>
      <span className={cn("text-[10px] font-black uppercase transition-colors", checked ? "text-emerald-600" : "text-black/60 group-hover:text-black")}>{label}</span>
    </button>
  );
}

