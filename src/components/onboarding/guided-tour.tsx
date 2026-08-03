"use client";

/**
 * @fileOverview Guia interativo LexisPredict v13 — alinhado ao produto atual
 * (sidebar 2026: Painel, Fila, Processos, Veredito, Documentos, Scanner, Analytics…)
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
  FileSpreadsheet,
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

/** Passos alinhados à sidebar e fluxos reais (agosto/2026) */
const TOUR_STEPS: TourStep[] = [
  {
    title: "Painel — radar do gabinete",
    content:
      "Visão matinal da carteira: vencidos, andamentos novos, baixas no tribunal, risco global e fila prioritária. Telemetria unifica sinais do DataJud (movimentos do tribunal) e do DJEN (publicações no diário oficial). Não substitui os autos — é triagem para decidir o que atender primeiro.",
    icon: <Zap />,
    route: "/",
    porQue: "Saber em segundos o que exige ação humana hoje.",
    rotina:
      "Abrir o dia no Painel → olhar Vencido / Andamentos / Baixas → abrir a fila prioritária → ir para Fila de contato ou Processos.",
    ganho: "Triagem matinal em menos de um minuto.",
    metrica: "Menos tempo escolhendo o que fazer; mais tempo atendendo.",
    tempo: "30–60 s",
    dicas: [
      "Use “Rede Judicial” só para diagnosticar latência dos tribunais.",
      "Números zero em Baixas ou Andamentos após um scan costumam indicar sincronização — rode o Scanner e atualize.",
    ],
  },
  {
    title: "Fila de contato (Tarefas)",
    content:
      "Ordem operacional de atendimento: eventos críticos e novidades antes de prazo genérico. Cada card reúne o cliente e os processos que pedem retorno. Use Sugerir resposta para mensagens prontas ao cliente (WhatsApp/e-mail) e registre o atendimento para zerar alertas só depois do contato humano.",
    icon: <ListTodo />,
    route: "/tarefas",
    porQue: "Garantir ordem de contato correta sob volume alto.",
    rotina:
      "Trabalhar o topo da fila → Sugerir resposta / copiar texto → contatar → Registrar atendimento (próximo retorno).",
    ganho: "Foco no crítico antes do genérico.",
    metrica: "Menos clientes críticos sem retorno no mesmo dia.",
    tempo: "1–3 min por card",
    dicas: [
      "O bloco âmbar “Resposta para o Cliente” fica no topo do modal — copie antes de rolar a cronologia.",
      "Exportar PDF da publicação DJEN está disponível quando houver link do diário.",
    ],
  },
  {
    title: "Processos — carteira completa",
    content:
      "Lista de toda a carteira da empresa logada. Filtre por escritório, status, ativos/encerrados ou novidade. Abra a Auditoria 3D (DataJud + DJEN), sugira resposta, registre atendimento. Exportar Excel gera relatório operacional formatado (assistente, escritório, advogado, cliente, protocolo, status, observações, movimentação, retornos) — sem IDs internos de banco.",
    icon: <Briefcase />,
    route: "/cases",
    porQue: "Gestão individual com evidência do tribunal e do diário.",
    rotina:
      "Buscar CNJ ou cliente → filtrar escritório/status → Auditoria 3D → ler cronologia → sugerir resposta → registrar atendimento.",
    ganho: "Histórico, despacho e planilha no mesmo fluxo.",
    metrica: "Zero novidade esquecida sem triagem.",
    tempo: "2 min",
    dicas: [
      "“Extrair Planilha” (CSV) e “Exportar Excel” usam só os processos da sua empresa (multi-tenant).",
      "Flags de novidade só descem após atendimento humano registrado.",
    ],
  },
  {
    title: "Consulta processo (Veredito)",
    content:
      "Auditoria 3D Elite sob demanda: busca por CNJ, CPF/CNPJ ou nome da parte. Cruza DataJud (classe, grau, polos ativo/passivo, movimentos) com publicações DJEN. Parecer determinístico funciona mesmo sem chave de IA; com IA, o contexto inclui as duas fontes.",
    icon: <Scale />,
    route: "/veredito",
    porQue: "Consultar um processo fora da fila sem perder o cruzamento tribunal + diário.",
    rotina:
      "Escolher modo (CNJ / CPF / Nome) → buscar → abrir processo → ler polos, movimentos e publicações → usar parecer / rascunho se precisar.",
    ganho: "Consulta forense rápida com polos e DJEN visíveis.",
    metrica: "Menos idas manuais ao PJe só para “o que saiu”.",
    tempo: "1–2 min",
    dicas: [
      "CPF nem sempre está indexado em todos os tribunais (LGPD/schema) — se vier vazio, tente nome ou CNJ.",
      "DJEN exige IP no Brasil em produção (região Vercel gru1 / São Paulo).",
    ],
  },
  {
    title: "DataJud Scanner",
    content:
      "Botão fixo na sidebar: varredura híbrida DataJud e/ou DJEN na carteira. Progresso local (retoma se recarregar a página). Use lotes conscientes — a API pública não é PJe e pode rate-limitar. Logs de erro (403 geo, 429, timeout) aparecem no status do caso.",
    icon: <ScanLine />,
    route: "/",
    porQue: "Atualizar a carteira em lote sem abrir processo por processo.",
    rotina:
      "Abrir Scanner → escolher modo (DataJud, DJEN ou ambos) → iniciar → acompanhar progresso → revisar Fila / Processos.",
    ganho: "Carteira sincronizada em background operacional.",
    metrica: "Menos “achismo” de andamento antigo na tela.",
    tempo: "Depende do volume",
    dicas: [
      "Lotes grandes são sequenciais de propósito (estabilidade).",
      "Se DJEN falhar com 403, confira a região do deploy (Brasil).",
    ],
  },
  {
    title: "Documentos jurídicos",
    content:
      "Procuração, Habilitação, Substabelecimento, Subst. simples e Peça de substabelecimento. Extração assistida + revisão humana + PDF profissional. Opção de incluir ou omitir nome/CNPJ do banco conforme a estratégia do caso.",
    icon: <FileSignature />,
    route: "/documents",
    porQue: "Gerar peças padronizadas sem recomeçar do zero a cada contrato.",
    rotina:
      "Colar/extrair dados → revisar campos → escolher se inclui banco → pré-visualizar → gerar PDF.",
    ganho: "Peça alinhada ao padrão do gabinete em minutos.",
    metrica: "Menos retrabalho de digitação e formatação.",
    tempo: "3–5 min",
    dicas: [
      "Habilitação e substabelecimentos ficam em rotas próprias no menu Operações.",
      "Sempre confira CPF/RG e poderes antes de protocolar.",
    ],
  },
  {
    title: "Importar carteira (CSV)",
    content:
      "Entrada em volume a partir de planilha. Normalização de CNJ, deduplicação e vínculo à empresa logada. Ideal na migração do Excel caótico para o gabinete digital.",
    icon: <Upload />,
    route: "/import",
    porQue: "Subir centenas de processos sem cadastro manual um a um.",
    rotina:
      "Preparar CSV → mapear colunas → importar → validar amostra em Processos → rodar Scanner.",
    ganho: "Migração controlada com rastreio por empresa.",
    metrica: "Carteira utilizável no mesmo dia da importação.",
    tempo: "5–15 min",
    dicas: [
      "CNJ com 20 dígitos é a chave de dedupe.",
      "Após importar, um scan híbrido alimenta andamentos e DJEN.",
    ],
  },
  {
    title: "WhatsApp e Assistente",
    content:
      "Atalhos de comunicação e chat de apoio. Scripts de resposta na Fila/Processos já montam o texto ao cliente; o Assistente ajuda em rascunhos e dúvidas operacionais. Nada disso substitui a análise do advogado responsável.",
    icon: <MessageCircle />,
    route: "/whatsapp",
    porQue: "Encurtar o caminho entre a novidade do processo e a mensagem ao cliente.",
    rotina:
      "Gerar texto em Sugerir resposta → abrir WhatsApp/copiar → registrar atendimento no app.",
    ganho: "Contato mais rápido com linguagem padronizada do gabinete.",
    metrica: "Menor tempo entre novidade e primeiro contato.",
    tempo: "1 min",
    dicas: [
      "Sempre personalize tom e fatos sensíveis antes de enviar.",
      "O Assistente (/chat) não inventa movimento de tribunal — confira a Auditoria 3D.",
    ],
  },
  {
    title: "Equipe e permissões",
    content:
      "Gestão de operadores, cargos e escopo multi-tenant. Administradores e supervisores veem a carteira da empresa; isolamento por empresa_id impede vazamento entre gabinetes.",
    icon: <Users />,
    route: "/team",
    porQue: "Escalar atendimento sem misturar carteiras de clientes diferentes.",
    rotina:
      "Convidar operador → definir cargo → validar que só vê processos da empresa → acompanhar KPIs se disponível.",
    ganho: "Time alinhado com o mesmo radar e as mesmas regras.",
    metrica: "Menos retrabalho por acesso errado ou dado cruzado.",
    tempo: "2 min",
    dicas: ["Apenas perfis admin/supervisor acessam Equipe."],
  },
  {
    title: "Indicadores e Urgências",
    content:
      "Analytics consolida volume, status e distribuição. Urgências destaca o que não pode esperar (prazos e sinais críticos). Use junto com o Painel: números para gestão, fila para execução.",
    icon: <BarChart3 />,
    route: "/analytics",
    porQue: "Enxergar a carteira como operação, não só como lista de CNJs.",
    rotina:
      "Semanalmente revisar Indicadores → cruzar com Urgências → ajustar capacidade da equipe.",
    ganho: "Decisão de gestão com base na carteira real.",
    metrica: "Menos surpresa de acúmulo de vencidos.",
    tempo: "3–5 min",
    dicas: [
      "Export Excel no Processos complementa o dossiê com planilha operacional.",
      "Urgências não substituem a Fila de contato no dia a dia.",
    ],
  },
  {
    title: "Configurações e Treinamento",
    content:
      "Preferências da conta, tema e atalhos. Esta tela de Treinamento (/onboarding) e o Guia interativo (tour) existem para onboarding de novos operadores — o vídeo de apoio pode atrasar em relação à UI; o guia escrito segue o menu atual.",
    icon: <Settings />,
    route: "/settings",
    porQue: "Padronizar o ambiente e treinar quem chega no gabinete.",
    rotina:
      "Configurar tema/preferências → rodar o Guia completo uma vez → usar /onboarding se houver vídeo institucional.",
    ganho: "Operador novo produtivo no mesmo dia.",
    metrica: "Menos dúvidas repetidas de “onde fica X”.",
    tempo: "5–10 min (guia completo)",
    dicas: [
      "Reabra o guia a qualquer momento pelo menu (Treinamento) ou pelo atalho de tour na sidebar.",
      "Em dúvida operacional grave, priorize o tribunal oficial (PJe/e-SAJ).",
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
