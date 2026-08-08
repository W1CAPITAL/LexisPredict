"use client";

/**
 * Guia interativo LexisPredict — revisao completa (produto atual 2026).
 * Cobre: operacao, scanners, IA, documentos, BA, revogacao, financas, CRM.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  X,
  ChevronRight,
  ChevronLeft,
  Zap,
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
  Sparkles,
  PlayCircle,
  Bell,
  Settings,
  ListTodo,
  ShieldAlert,
  Bot,
  ClipboardList,
  Search,
  Gavel,
  DollarSign,
  Globe,
  CheckCircle2,
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
  dicas?: string[];
}

const TOUR_STEPS: TourStep[] = [
  {
    title: "Bem-vindo ao LexisPredict",
    content:
      "SaaS multi-tenant de operacao juridica: carteira, prazos, atendimento, auditoria CNJ (DataJud), diario oficial (DJEN), documentos, equipe e IA (Claude/OmniRoute + cascata). Este guia percorre o menu real do app — use como treinamento de novos operadores.",
    icon: <Sparkles />,
    route: "/",
    porQue: "Entender o mapa antes de operar volume.",
    rotina: "Rodar o guia uma vez → fixar Painel + Fila + Processos como rotina diaria.",
    ganho: "Onboarding em minutos, sem depender de video desatualizado.",
    metrica: "Operador novo produtivo no mesmo dia.",
    tempo: "12–20 min (guia completo)",
    dicas: [
      "Em divergencia entre video e tela, confie neste guia e no menu lateral.",
      "DataJud e DJEN sao triagem — nao substituem PJe/e-SAJ.",
    ],
  },
  {
    title: "Painel — radar do gabinete",
    content:
      "Visao matinal: vencidos, andamentos novos, baixas, risco global e fila prioritaria. Telemetria une DataJud (movimentos) e DJEN (publicacoes). Indices de risco explicam fatores (prazo, BA, silencio do cliente) — use para priorizar, nao como laudo juridico.",
    icon: <Zap />,
    route: "/",
    porQue: "Saber em segundos o que exige acao humana hoje.",
    rotina: "Abrir o dia no Painel → Vencido / Andamentos / Baixas → fila prioritaria → Fila de contato ou Processos.",
    ganho: "Triagem matinal em menos de um minuto.",
    metrica: "Menos tempo escolhendo; mais tempo atendendo.",
    tempo: "30–60 s",
    dicas: ["Apos scan em lote, atualize o Painel.", "Risco global e operacional + processual combinados."],
  },
  {
    title: "Fila de contato (Tarefas)",
    content:
      "Ordem de atendimento: criticos e novidades antes de prazo generico. Cards por cliente. Sugerir resposta gera mensagens para WhatsApp/e-mail (scripts Lexis + IA Claude/OmniRoute). Auditoria 3D nesta tela consulta so DJEN (rapido). Registre o contato para zerar a fila.",
    icon: <ListTodo />,
    route: "/tarefas",
    porQue: "Nao perder retorno ao cliente apos novidade no tribunal.",
    rotina: "Filtrar novidade/BA/problema → Sugerir resposta → copiar → registrar atendimento.",
    ganho: "Fila objetiva, rascunhos prontos.",
    metrica: "Meta do dia e finalizados no topo da tela.",
    tempo: "2–5 min por cliente",
    dicas: [
      "Sugerir resposta usa DataJud+DJEN; Auditoria 3D usa so DJEN.",
      "Refine o rascunho com o teor real antes de enviar ao cliente.",
    ],
  },
  {
    title: "Processos — carteira",
    content:
      "Lista completa da carteira do usuario/empresa. Adicionar processo, editar, scan, sugerir resposta, dossie do cliente/processo, exportar Excel (abas limpas de auditoria), recalibrar prazos. Isolamento por empresa_id e perfil.",
    icon: <Briefcase />,
    route: "/cases",
    porQue: "Fonte de verdade da operacao diaria.",
    rotina: "Filtrar novidade/vencido → acao no card → exportar quando precisar reportar.",
    ganho: "Carteira grande (ex.: 1000+ processos) operavel na UI.",
    metrica: "Menos planilha paralela fora do sistema.",
    tempo: "conforme volume",
    dicas: ["Botao de novo processo fica no topo da aba.", "Excel exporta so dados do usuario logado, formatado."],
  },
  {
    title: "Scanner tribunal (DataJud + DJEN)",
    content:
      "Motor de sincronizacao: DataJud (movimentos CNJ) e DJEN (diario). Lotes sequenciais por estabilidade. Flags: novidade, encerrado, cumprimento, indicios BA. IA opcional (Claude/OmniRoute) classifica eventos — escolha o motor no scanner e veja no log qual IA rodou.",
    icon: <Globe />,
    route: "/",
    porQue: "Atualizar a carteira sem abrir processo a processo no tribunal.",
    rotina: "Disparar scanner → acompanhar log → tratar novidades na Fila/Processos.",
    ganho: "Cobertura de volume inviavel manualmente.",
    metrica: "Taxa de sucesso DataJud/DJEN por empresa (telemetria).",
    tempo: "minutos a horas conforme lote",
    dicas: [
      "Vercel Hobby: cron limitado; operacao real e lote manual/nuvem.",
      "DJEN pode falhar fora do Brasil (403) — deploy em gru1 ajuda.",
    ],
  },
  {
    title: "Busca e Apreensao",
    content:
      "Varredura DJEN por teor de BA, cruzamento com clientes da carteira e banca. IA confirma se e mandado real de apreensao de bem (nao basta a palavra aparecer). Log mostra a IA usada. Filtro 'so com match' prioriza o que e seu.",
    icon: <Gavel />,
    route: "/busca-apreensao",
    porQue: "Detectar BA relevante sem ler o diario inteiro.",
    rotina: "Periodo 7–60 dias → Varrer → so match → abrir teor → acionar equipe.",
    ganho: "Alerta operacional precoce.",
    metrica: "Matches na carteira vs ruido.",
    tempo: "5–15 min",
    dicas: ["Priorize nome do cliente; advogado e criterio auxiliar.", "Claude/OmniRoute reduz falso positivo."],
  },
  {
    title: "Assistente IA (/chat)",
    content:
      "Copiloto geral: qualquer pergunta (nao so processo). Anexe PDF ou imagem (decisao ou qualquer documento). Pensamento visivel em perguntas complexas. CNJ na mensagem dispara consulta DJEN automatica. Motores: Claude/OmniRoute, Groq, xAI, OpenRouter, GPT4Free (fallback gratis), etc.",
    icon: <Bot />,
    route: "/chat",
    porQue: "Acelerar analise, redacao e leitura de pecas.",
    rotina: "Perguntar → anexar PDF/print se houver → revisar resposta → copiar ao cliente se couber.",
    ganho: "Leitura e rascunho em segundos.",
    metrica: "Menos tempo em teor extenso.",
    tempo: "1–3 min",
    dicas: [
      "Oi/cumprimento usa caminho rapido (sem tags XML na tela).",
      "PDF escaneado: use print/OCR se a extracao falhar.",
      "Nunca envie ao cliente sem revisao humana.",
    ],
  },
  {
    title: "Consulta processo (Veredito)",
    content:
      "Consulta pontual de CNJ com contexto tribunal e apoio de IA. Complementa o scanner quando voce precisa de um processo especifico agora.",
    icon: <Scale />,
    route: "/veredito",
    porQue: "Olho cirurgico em um CNJ sem varrer a carteira inteira.",
    rotina: "Colar CNJ → consultar → ler movimentacoes/publicacoes → decidir proximo passo.",
    ganho: "Resposta rapida em reuniao ou ligacao.",
    metrica: "Tempo ate teor util.",
    tempo: "1–2 min",
    dicas: ["Combine com Assistente se precisar de mensagem ao cliente."],
  },
  {
    title: "Cadastro / Automacao judicial",
    content:
      "Pipeline 01–08: captura, triagem, cadastro na carteira, classificacao, demanda, analise, devolutiva, recomendacoes. Custas TJSP em subaba. eproc SP prioritario; e-SAJ secundario. Captura e OCR de prints do tribunal.",
    icon: <ClipboardList />,
    route: "/ia-sync",
    porQue: "Entrada padronizada de novos casos e custas.",
    rotina: "Capturar → triar → cadastrar → seguir pipeline ate recomendacao.",
    ganho: "Menos erro de cadastro manual.",
    metrica: "Casos novos consistentes na carteira.",
    tempo: "conforme peca",
    dicas: ["Sync DataJud/DJEN ou cadastro manual.", "Sidebar: item Cadastro."],
  },
  {
    title: "Documentos: procuracao, habilitacao, substabelecimento",
    content:
      "Geracao de pecas e formularios: Procuracao, Habilitacao, Substabelecimento (varios fluxos), Revogacao de poderes com substabelecimento (fila 1 a 1, DJEN, CPF opcional do diario, PDF judicial sem mencionar IA).",
    icon: <FileSignature />,
    route: "/documents",
    porQue: "Padronizar pecas com dados da banca e da carteira.",
    rotina: "Escolher peca → selecionar advogado/cliente → validar elegibilidade → baixar PDF.",
    ganho: "Documento pronto para protocolo/assinatura.",
    metrica: "Menos retrabalho de minuta.",
    tempo: "3–10 min",
    dicas: [
      "Revogacao: /revogacao-poderes — scanner em fila, Claude so na elegibilidade.",
      "Dados do advogado vêm da Banca (Configuracoes).",
    ],
  },
  {
    title: "Financas e honorarios",
    content:
      "Modulo financeiro alinhado ao gabinete: acompanhamento de valores/honorarios no escopo da operacao (nao substitui ERP contábil completo).",
    icon: <DollarSign />,
    route: "/financas",
    porQue: "Ligar carteira processual a cobranca basica.",
    rotina: "Registrar/consultar honorarios vinculados ao fluxo operacional.",
    ganho: "Visibilidade minima de financeiro no mesmo login.",
    metrica: "Menos planilha solta de honorarios.",
    tempo: "conforme uso",
    dicas: ["Use junto com exportacoes quando for reportar ao socio."],
  },
  {
    title: "Notas CRM e historico do cliente",
    content:
      "Anotacoes por cliente/protocolo, edicao, sync com historico. Apoio ao atendimento e ao dossie.",
    icon: <StickyNote />,
    route: "/notes",
    porQue: "Nao perder combinados e observacoes de ligacao.",
    rotina: "Apos contato → gravar nota → ela alimenta dossie/CRM.",
    ganho: "Memoria da equipe no processo certo.",
    metrica: "Menos 'ninguem anotou'.",
    tempo: "30 s–2 min",
    dicas: ["Se notas falharem ao carregar, reporte digest do erro de Server Component."],
  },
  {
    title: "Importar, OCR, WhatsApp",
    content:
      "Importacao em lote para a carteira; OCR de prints/documentos; atalhos WhatsApp para contato. Ferramentas de apoio ao volume.",
    icon: <Upload />,
    route: "/import",
    porQue: "Entrar com base legada e prints do tribunal.",
    rotina: "Importar planilha → OCR se precisar texto → contatar via WhatsApp.",
    ganho: "Migracao e captura sem retrabalho total.",
    metrica: "Volume importado vs erros de linha.",
    tempo: "conforme arquivo",
    dicas: ["Valide amostra apos import antes de scan em massa."],
  },
  {
    title: "Equipe, Configuracoes e Banca",
    content:
      "Equipe (admin): usuarios e papeis. Configuracoes: tema, nucleo neural (motores IA), banca de advogados com telefone, e-mail, endereco profissional e dados para procuracao. Nucleo neural: Claude, Groq, xAI, OpenRouter, GPT4Free, Puter, etc.",
    icon: <Settings />,
    route: "/settings",
    porQue: "Governanca multi-tenant e dados certos nas pecas.",
    rotina: "Cadastrar banca completa → escolher motor padrao → convidar equipe.",
    ganho: "Pecas e IA alinhadas ao escritorio.",
    metrica: "Zero peca com advogado incompleto.",
    tempo: "10–20 min setup",
    dicas: ["Nunca cole API keys na UI — so no Vercel Env.", "GPT4Free e fallback; preferira Claude/OmniRoute."],
  },
  {
    title: "Indicadores, Urgencias e Relatorios",
    content:
      "Analytics da carteira, urgencias e relatorios (incluindo enriquecimento Claude/OmniRoute quando configurado). Dossie operacional estrategico (PDF premium) a partir do dashboard/processo — risco, timeline, DJEN, plano de acao.",
    icon: <BarChart3 />,
    route: "/analytics",
    porQue: "Gestao e prestacao de contas com evidencia.",
    rotina: "Semana: indicadores → urgencias → dossies dos casos criticos.",
    ganho: "Narrativa executiva pronta.",
    metrica: "Tempo ate PDF de dossie.",
    tempo: "5–15 min",
    dicas: ["Dossie do cliente/processo sai das abas Processos com botao dedicado."],
  },
  {
    title: "Boas praticas e limites",
    content:
      "LexisPredict e triagem e operacao. DataJud pode atrasar; DJEN pode 403 fora do BR; heuristica de BA/encerramento nao e garantia juridica; IA erra — revise sempre. Isolamento por empresa_id. Software proprietario.",
    icon: <ShieldAlert />,
    route: "/",
    porQue: "Operar com expectativa correta e risco controlado.",
    rotina: "Triagem no Lexis → decisao grave no sistema do tribunal.",
    ganho: "Menos falso positivo e menos expectativa irreal do cliente.",
    metrica: "Revisao humana em 100% das mensagens externas.",
    tempo: "continuo",
    dicas: [
      "Deploy Vercel em Sao Paulo (gru1) para DJEN.",
      "Um caminho de deploy: git push → Vercel (evite upload parcial).",
      "Reabra este guia em Treinamento (/onboarding) quando entrar gente nova.",
    ],
  },
];


export function GuidedTour() {
  const router = useRouter();
  const pathname = usePathname();
  const { isTutorialActive, setTutorialActive, tutorialStep, setTutorialStep } =
    useAppStore();
  const [showVideo, setShowVideo] = useState(false);
  const [anim, setAnim] = useState(true);

  const step = TOUR_STEPS[Math.min(tutorialStep, TOUR_STEPS.length - 1)];
  const progress = useMemo(
    () => ((tutorialStep + 1) / TOUR_STEPS.length) * 100,
    [tutorialStep]
  );

  useEffect(() => {
    if (!isTutorialActive) return;
    setAnim(false);
    const t = requestAnimationFrame(() => setAnim(true));
    return () => cancelAnimationFrame(t);
  }, [tutorialStep, isTutorialActive]);

  useEffect(() => {
    if (!isTutorialActive || !step?.route) return;
    if (pathname !== step.route) {
      // navegação suave sugerida — não força se já estiver em fluxo crítico
    }
  }, [isTutorialActive, step, pathname]);

  if (!isTutorialActive || !step) return null;

  const finishTour = () => {
    setTutorialActive(false);
    setTutorialStep(0);
    setShowVideo(false);
  };

  const handleNext = () => {
    if (tutorialStep >= TOUR_STEPS.length - 1) {
      finishTour();
      return;
    }
    setTutorialStep(tutorialStep + 1);
  };

  const handlePrev = () => {
    if (tutorialStep <= 0) return;
    setTutorialStep(tutorialStep - 1);
  };

  const goToRoute = () => {
    if (step.route) router.push(step.route);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-3 sm:p-6 bg-black/50 backdrop-blur-[2px]">
      <div
        className={cn(
          "w-full max-w-3xl max-h-[92vh] flex flex-col bg-card border border-border rounded-2xl shadow-2xl overflow-hidden",
          "transition-all duration-300",
          anim ? "opacity-100 translate-y-0" : "opacity-90 translate-y-1"
        )}
        role="dialog"
        aria-modal="true"
        aria-label={`Guia do sistema — passo ${tutorialStep + 1} de ${TOUR_STEPS.length}`}
      >
        {/* Header */}
        <div className="shrink-0 border-b border-border bg-foreground text-background px-5 sm:px-6 py-4 flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
              Guia do sistema · {tutorialStep + 1}/{TOUR_STEPS.length}
            </p>
            <h2 className="text-base sm:text-lg font-bold tracking-tight truncate flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary shrink-0">
                {step.icon}
              </span>
              <span className="truncate">{step.title}</span>
            </h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={finishTour}
            className="h-9 w-9 rounded-lg text-background/70 hover:text-background hover:bg-white/10 shrink-0"
            aria-label="Fechar guia"
          >
            <X size={18} />
          </Button>
        </div>

        {/* Progress */}
        <div className="h-1 bg-muted shrink-0">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {showVideo ? (
            <div className="p-5 sm:p-6 space-y-4">
              <p className="text-sm text-muted-foreground">
                Vídeo institucional de apoio. A interface pode evoluir mais rápido que o
                vídeo — em caso de divergência, confie neste guia e no menu lateral.
              </p>
              <div className="rounded-xl overflow-hidden border border-border bg-black aspect-video">
                <video
                  className="w-full h-full"
                  controls
                  playsInline
                  src="/Onboarding_LexisPredict.mp4"
                >
                  Seu navegador não suporta vídeo HTML5.
                </video>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowVideo(false)}
                className="w-full sm:w-auto"
              >
                Voltar ao guia escrito
              </Button>
            </div>
          ) : (
            <div className="p-5 sm:p-6 space-y-5">
              <p className="text-[15px] leading-relaxed text-foreground/90">
                {step.content}
              </p>

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-border bg-secondary/40 p-4 space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Por quê
                  </p>
                  <p className="text-[13px] font-medium leading-snug">{step.porQue}</p>
                </div>
                <div className="rounded-xl border border-border bg-secondary/40 p-4 space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Rotina sugerida
                  </p>
                  <p className="text-[13px] font-medium leading-snug">{step.rotina}</p>
                </div>
                <div className="rounded-xl border border-border bg-secondary/40 p-4 space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Ganho
                  </p>
                  <p className="text-[13px] font-medium leading-snug">{step.ganho}</p>
                </div>
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                    Tempo estimado
                  </p>
                  <p className="text-xl font-bold tabular-nums tracking-tight">
                    {step.tempo}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{step.metrica}</p>
                </div>
              </div>

              {step.dicas && step.dicas.length > 0 && (
                <div className="rounded-xl border border-border p-4 space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <CheckCircle2 size={12} className="text-primary" /> Dicas práticas
                  </p>
                  <ul className="space-y-1.5">
                    {step.dicas.map((d, i) => (
                      <li
                        key={i}
                        className="text-[13px] leading-snug text-foreground/85 pl-3 border-l-2 border-primary/30"
                      >
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="rounded-xl border border-amber-500/30 bg-amber-50/80 dark:bg-amber-950/30 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200 mb-1">
                  Limite honesto
                </p>
                <p className="text-[12px] leading-relaxed text-amber-900/80 dark:text-amber-100/80">
                  DataJud e DJEN são triagem. Prazos fatais, liminares e B.A. exigem
                  conferência no sistema oficial do tribunal (PJe / e-SAJ) antes de
                  qualquer orientação definitiva ao cliente.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!showVideo && (
          <div className="shrink-0 border-t border-border bg-muted/40 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={handlePrev}
                disabled={tutorialStep === 0}
                className="h-10 px-3 text-[11px] font-semibold uppercase"
              >
                <ChevronLeft size={16} className="mr-1" /> Anterior
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={goToRoute}
                className="h-10 px-3 text-[11px] font-semibold uppercase"
              >
                Abrir tela
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowVideo(true)}
                className="h-10 px-3 text-[11px] font-semibold uppercase text-muted-foreground"
              >
                <PlayCircle size={14} className="mr-1" /> Vídeo
              </Button>
            </div>
            <div className="flex gap-2 ml-auto">
              <Button
                type="button"
                variant="ghost"
                onClick={finishTour}
                className="h-10 px-3 text-[11px] font-semibold uppercase text-muted-foreground"
              >
                Encerrar
              </Button>
              <Button
                type="button"
                onClick={handleNext}
                className="h-10 px-4 bg-foreground text-background hover:bg-primary hover:text-primary-foreground text-[11px] font-semibold uppercase"
              >
                {tutorialStep === TOUR_STEPS.length - 1 ? "Concluir" : "Próximo"}
                <ChevronRight size={16} className="ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
