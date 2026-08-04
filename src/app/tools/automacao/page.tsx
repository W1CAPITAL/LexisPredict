/**
 * Automação Judicial — pipeline 01–08 + eproc SP + embed no app
 * Rota do menu: /tools/automacao
 */
"use client";

import React, { useMemo, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  Search,
  ExternalLink,
  Scale,
  Receipt,
  Copy,
  Maximize2,
  Minimize2,
  X,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Building2,
  Sparkles,
  FileSearch,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  enrichMultiTribunalAction,
  getMultiConsultaUrlAction,
} from "@/app/actions/multi-tribunal-actions";
import { openTribunalViaGcloudAction } from "@/app/actions/gcloud-tribunal-actions";
import {
  TODOS_TRIBUNAIS,
  getTribunalByCnj,
  getFallbacksForCnj,
} from "@/lib/tribunais-links";
import {
  AUTOMACAO_PIPELINE,
  type PipelineStepId,
} from "@/lib/automacao-pipeline";
import { cn } from "@/lib/utils";
import Link from "next/link";

export const PORTAL_CUSTAS_TJSP =
  "https://portaldecustas.tjsp.jus.br/portaltjsp/pages/custas/new";

type TabId = "pipeline" | "custas";

function onlyDigits(s: string) {
  return s.replace(/\D/g, "");
}

export default function AutomacaoJudicialPage() {
  const [tab, setTab] = useState<TabId>("pipeline");
  const [step, setStep] = useState<PipelineStepId>("captura");
  const [cnj, setCnj] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [resultado, setResultado] = useState<any>(null);
  const [doneSteps, setDoneSteps] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState("");
  const [classificacao, setClassificacao] = useState("");
  const [ofensor, setOfensor] = useState("");
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [embedTitle, setEmbedTitle] = useState("");
  const [embedExpanded, setEmbedExpanded] = useState(true);
  const { toast } = useToast();

  // Custas subaba
  const [custasCnj, setCustasCnj] = useState("");
  const [custasCpf, setCustasCpf] = useState("");
  const [showPortal, setShowPortal] = useState(false);

  const cleanCnj = cnj.replace(/\D/g, "");
  const tribunalPreview = cnj.trim() ? getTribunalByCnj(cnj) : null;
  const fallbacks = cnj.trim() ? getFallbacksForCnj(cnj) : [];

  const currentMeta = useMemo(
    () => AUTOMACAO_PIPELINE.find((s) => s.id === step)!,
    [step]
  );

  const markDone = (id: string) =>
    setDoneSteps((prev) => new Set(prev).add(id));

  const doCopy = async (label: string, value: string) => {
    if (!value.trim()) return;
    try {
      await navigator.clipboard.writeText(value.trim());
      toast({ title: `${label} copiado` });
    } catch {
      toast({ title: "Falha ao copiar", variant: "destructive" });
    }
  };

  const openEmbed = (url: string, title: string) => {
    setEmbedUrl(url);
    setEmbedTitle(title);
    setEmbedExpanded(true);
  };

  /** 01 Captura — eproc no app + enrich */
  const runCaptura = async () => {
    if (cleanCnj.length !== 20) {
      toast({ title: "CNJ inválido", variant: "destructive" });
      return;
    }
    const preview = getTribunalByCnj(cnj);
    if (preview?.url) {
      openEmbed(
        preview.url,
        `${preview.sigla} · ${preview.sistema} (principal)`
      );
    }
    setLoading("captura");
    try {
      const res = await openTribunalViaGcloudAction(cnj, "fetch");
      if (res.openUrl) {
        openEmbed(
          res.openUrl,
          `${res.tribunal || preview?.sigla} · ${res.sistema || preview?.sistema}`
        );
      }
      if (res.data) {
        setResultado({
          success: true,
          data: res.data,
          note: res.message,
          multi: {
            tribunal: res.tribunal,
            sistema: res.sistema,
            url: res.openUrl,
            modo: "captura",
          },
        });
      }
      markDone("captura");
      toast({
        title: "01 Captura",
        description: "Tribunal no app + tentativa de enrich e-SAJ",
      });
      setStep("triagem");
    } catch (e: any) {
      toast({ title: "Erro captura", description: e.message, variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  /** 02 Triagem — multi enrich / classificação automática leve */
  const runTriagem = async () => {
    if (cleanCnj.length !== 20) {
      toast({ title: "CNJ inválido", variant: "destructive" });
      return;
    }
    setLoading("triagem");
    try {
      const res = await enrichMultiTribunalAction(cnj);
      setResultado(res);
      markDone("triagem");
      toast({ title: "02 Triagem", description: res.note || "Categorização aplicada" });
      setStep("cadastro");
    } catch (e: any) {
      toast({ title: "Erro triagem", description: e.message, variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  const grau =
    resultado?.data?.["Primeiro Grau"] ||
    resultado?.data?.["Segundo Grau"] ||
    null;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 p-4 md:p-8 max-w-6xl mx-auto space-y-6 overflow-auto">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Scale className="w-6 h-6 text-primary" />
            Automação Judicial
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Pipeline 01–08 · eproc prioritário (SP) · consulta no app · Custas em subaba
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-border">
          <button
            type="button"
            onClick={() => setTab("pipeline")}
            className={cn(
              "px-4 py-2.5 text-[11px] font-black uppercase tracking-widest rounded-t-xl border border-b-0",
              tab === "pipeline"
                ? "bg-card border-border"
                : "text-muted-foreground border-transparent"
            )}
          >
            Pipeline operacional
          </button>
          <button
            type="button"
            onClick={() => setTab("custas")}
            className={cn(
              "px-4 py-2.5 text-[11px] font-black uppercase tracking-widest rounded-t-xl border border-b-0",
              tab === "custas"
                ? "bg-card border-border"
                : "text-muted-foreground border-transparent"
            )}
          >
            <span className="inline-flex items-center gap-2">
              <Receipt size={14} /> Custas (TJSP)
            </span>
          </button>
        </div>

        {tab === "pipeline" && (
          <div className="space-y-6">
            {/* Stepper */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
              {AUTOMACAO_PIPELINE.map((s) => {
                const active = step === s.id;
                const done = doneSteps.has(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStep(s.id)}
                    className={cn(
                      "text-left p-2.5 rounded-xl border transition-colors",
                      active && "border-primary bg-primary/5",
                      done && !active && "border-emerald-500/40 bg-emerald-500/5",
                      !active && !done && "border-border/50"
                    )}
                  >
                    <div className="flex items-center gap-1 mb-1">
                      {done ? (
                        <CheckCircle2 size={12} className="text-emerald-600" />
                      ) : (
                        <span className="text-[9px] font-black text-muted-foreground">
                          {s.num}
                        </span>
                      )}
                      <span className="text-[10px] font-black uppercase truncate">
                        {s.title}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="text-primary font-black">{currentMeta.num}</span>
                  {currentMeta.title}
                </CardTitle>
                <CardDescription>{currentMeta.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(step === "captura" ||
                  step === "triagem" ||
                  step === "cadastro") && (
                  <>
                    <Label className="text-[9px] font-black uppercase">CNJ</Label>
                    <Input
                      value={cnj}
                      onChange={(e) => setCnj(e.target.value)}
                      placeholder="0000000-00.0000.8.26.0000"
                      className="font-mono h-12 text-lg"
                    />
                    {tribunalPreview && (
                      <div className="flex flex-wrap gap-2 items-center text-[11px]">
                        <Badge className="font-black">{tribunalPreview.sigla}</Badge>
                        <Badge variant="outline" className="uppercase text-[9px]">
                          {tribunalPreview.sistema} (principal)
                        </Badge>
                        {tribunalPreview.esajFamily && (
                          <Badge variant="secondary" className="text-[9px]">
                            e-SAJ disponível
                          </Badge>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* Ações por etapa */}
                {step === "captura" && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={runCaptura}
                      disabled={!!loading}
                      className="gap-2 h-11 font-bold"
                    >
                      {loading === "captura" ? (
                        <Loader2 className="animate-spin h-4 w-4" />
                      ) : (
                        <Building2 className="h-4 w-4" />
                      )}
                      Capturar no app (eproc / consulta)
                    </Button>
                    {fallbacks.map((f, i) => (
                      <Button
                        key={i}
                        type="button"
                        variant="outline"
                        className="h-11"
                        onClick={() =>
                          openEmbed(f.url, f.label || f.sistema)
                        }
                      >
                        {f.label || f.sistema}
                      </Button>
                    ))}
                  </div>
                )}

                {step === "triagem" && (
                  <Button
                    onClick={runTriagem}
                    disabled={!!loading}
                    className="gap-2 h-11 font-bold"
                  >
                    {loading === "triagem" ? (
                      <Loader2 className="animate-spin h-4 w-4" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    Rodar triagem (multi-tribunal / e-SAJ)
                  </Button>
                )}

                {step === "cadastro" && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Abra a carteira com o CNJ para cadastrar/atualizar o processo no ERP.
                    </p>
                    <Button asChild className="h-11 font-bold gap-2">
                      <Link
                        href={`/cases?search=${encodeURIComponent(cnj || "")}`}
                      >
                        Ir para Processos <ChevronRight size={16} />
                      </Link>
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        markDone("cadastro");
                        setStep("classificacao");
                      }}
                    >
                      Marcar cadastro feito e avançar
                    </Button>
                  </div>
                )}

                {step === "classificacao" && (
                  <div className="space-y-3">
                    <Label>Serviço / produto</Label>
                    <Input
                      value={classificacao}
                      onChange={(e) => setClassificacao(e.target.value)}
                      placeholder="Ex.: revisional, busca e apreensão, cobrança…"
                    />
                    <Label>Ofensor / parte contrária</Label>
                    <Input
                      value={ofensor}
                      onChange={(e) => setOfensor(e.target.value)}
                      placeholder="Ex.: banco, financeira…"
                    />
                    <Button
                      onClick={() => {
                        markDone("classificacao");
                        setStep("demanda");
                        toast({ title: "04 Classificação registrada" });
                      }}
                    >
                      Salvar e avançar
                    </Button>
                  </div>
                )}

                {step === "demanda" && (
                  <div className="space-y-3">
                    <Label>Insumos necessários (acordo / defesa)</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Contrato, extratos, guias, procurações…"
                      className="min-h-[100px]"
                    />
                    <Button
                      onClick={() => {
                        markDone("demanda");
                        setStep("analise");
                      }}
                    >
                      Avançar para análise
                    </Button>
                  </div>
                )}

                {step === "analise" && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Use Veredito / DataJud·DJEN e o embed do tribunal para cruzar evidências.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild variant="secondary" className="gap-2">
                        <Link href="/veredito">
                          <FileSearch size={16} /> Veredito
                        </Link>
                      </Button>
                      <Button
                        type="button"
                        onClick={() => {
                          markDone("analise");
                          setStep("devolutiva");
                        }}
                      >
                        Análise concluída
                      </Button>
                    </div>
                  </div>
                )}

                {step === "devolutiva" && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Rascunhos leigos e protetivos: use Processos/Tarefas → Sugerir resposta
                      (Motor Lexis + IA opcional).
                    </p>
                    <Button asChild className="gap-2">
                      <Link
                        href={`/tarefas?search=${encodeURIComponent(cnj || "")}`}
                      >
                        <Sparkles size={16} /> Abrir fila / sugestões
                      </Link>
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        markDone("devolutiva");
                        setStep("recomendacoes");
                      }}
                    >
                      Avançar
                    </Button>
                  </div>
                )}

                {step === "recomendacoes" && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Consolide estratégia com base na captura, triagem e análise. Documente em Notas.
                    </p>
                    <Button asChild variant="outline">
                      <Link href="/notes">Abrir Notas</Link>
                    </Button>
                    <Button
                      onClick={() => {
                        markDone("recomendacoes");
                        toast({
                          title: "Pipeline completo",
                          description: "08 Recomendações registradas nesta sessão",
                        });
                      }}
                    >
                      Finalizar pipeline
                    </Button>
                  </div>
                )}

                {/* Embed tribunal — sempre visível se aberto */}
                {embedUrl && (
                  <div className="rounded-xl border-2 border-primary/30 overflow-hidden bg-white">
                    <div className="h-11 flex items-center justify-between px-2 bg-muted/60 border-b gap-2">
                      <span className="text-[10px] font-bold truncate px-2">
                        {embedTitle} — {embedUrl.replace(/^https?:\/\//, "").slice(0, 40)}…
                      </span>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => setEmbedExpanded((v) => !v)}
                        >
                          {embedExpanded ? (
                            <Minimize2 size={14} />
                          ) : (
                            <Maximize2 size={14} />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          title="Nova aba só se iframe bloqueado"
                          onClick={() =>
                            window.open(embedUrl, "_blank", "noopener,noreferrer")
                          }
                        >
                          <ExternalLink size={14} />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => setEmbedUrl(null)}
                        >
                          <X size={14} />
                        </Button>
                      </div>
                    </div>
                    {embedExpanded && (
                      <iframe
                        src={embedUrl}
                        title={embedTitle}
                        className="w-full border-0"
                        style={{ height: "min(70vh, 720px)", minHeight: 480 }}
                        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                    )}
                    <p className="text-[10px] text-muted-foreground p-2 border-t flex gap-1">
                      <AlertCircle size={12} className="shrink-0 mt-0.5" />
                      SP: eproc é o principal. Se o iframe ficar branco (bloqueio do tribunal), use o ícone de nova aba.
                    </p>
                  </div>
                )}

                {/* Movimentos se enrich */}
                {grau?.movimentações?.length > 0 && (
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm">Movimentações capturadas</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 max-h-64 overflow-auto">
                      {grau.movimentações.slice(0, 12).map((m: any, i: number) => (
                        <div key={i} className="text-sm border rounded-lg p-2">
                          <span className="text-xs text-muted-foreground">{m.data}</span>
                          <p>{m.descricao}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {tab === "custas" && (
          <Card className="border-amber-500/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Receipt className="text-amber-600" size={18} />
                Portal de Custas TJSP
              </CardTitle>
              <CardDescription>Subaba auxiliar · CAPTCHA manual</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={custasCnj}
                onChange={(e) => setCustasCnj(e.target.value)}
                placeholder="CNJ"
                className="font-mono"
              />
              <Input
                value={custasCpf}
                onChange={(e) =>
                  setCustasCpf(onlyDigits(e.target.value).slice(0, 11))
                }
                placeholder="CPF"
                className="font-mono"
              />
              <div className="flex gap-2">
                <Button
                  className="bg-amber-600 hover:bg-amber-700"
                  onClick={() => {
                    if (custasCnj) doCopy("CNJ", custasCnj);
                    setShowPortal(true);
                    openEmbed(PORTAL_CUSTAS_TJSP, "Portal de Custas TJSP");
                  }}
                >
                  Abrir portal no app
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    window.open(PORTAL_CUSTAS_TJSP, "_blank", "noopener,noreferrer")
                  }
                >
                  Nova aba
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
