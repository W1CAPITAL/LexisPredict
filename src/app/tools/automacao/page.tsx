/**
 * Automação Judicial — pipeline 01–08
 * Captura com print/OCR · Cadastro DIRETO na carteira (Processos)
 * eproc SP principal · embed no app · Custas subaba
 */
"use client";

import React, { useMemo, useState, useRef } from "react";
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
  Upload,
  ImageIcon,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  enrichMultiTribunalAction,
} from "@/app/actions/multi-tribunal-actions";
import { openTribunalViaGcloudAction } from "@/app/actions/gcloud-tribunal-actions";
import {
  registerCaseFromAutomacaoAction,
  transcribeTribunalPrintAction,
} from "@/app/actions/automacao-register-actions";
import {
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
  const [ocrText, setOcrText] = useState("");
  const [cliente, setCliente] = useState("");
  const [telefone, setTelefone] = useState("");
  const [classificacao, setClassificacao] = useState("");
  const [ofensor, setOfensor] = useState("");
  const [observacao, setObservacao] = useState("");
  const [insumos, setInsumos] = useState("");
  const [firacNotes, setFiracNotes] = useState("");
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [embedTitle, setEmbedTitle] = useState("");
  const [embedExpanded, setEmbedExpanded] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const [custasCnj, setCustasCnj] = useState("");
  const [custasCpf, setCustasCpf] = useState("");

  const cleanCnj = cnj.replace(/\D/g, "");
  const tribunalPreview = cnj.trim() ? getTribunalByCnj(cnj) : null;
  const fallbacks = cnj.trim() ? getFallbacksForCnj(cnj) : [];

  const currentMeta = useMemo(
    () => AUTOMACAO_PIPELINE.find((s) => s.id === step)!,
    [step]
  );

  const markDone = (id: string) =>
    setDoneSteps((prev) => new Set(prev).add(id));

  const openEmbed = (url: string, title: string) => {
    setEmbedUrl(url);
    setEmbedTitle(title);
    setEmbedExpanded(true);
  };

  const doCopy = async (label: string, value: string) => {
    if (!value.trim()) return;
    try {
      await navigator.clipboard.writeText(value.trim());
      toast({ title: `${label} copiado` });
    } catch {
      /* ignore */
    }
  };

  /** Print / screenshot → transcrição */
  const onPrintFile = async (file: File) => {
    setLoading("ocr");
    try {
      if (file.type.startsWith("text/") || file.name.endsWith(".txt")) {
        const text = await file.text();
        const res = await transcribeTribunalPrintAction({ text });
        if (res.success && res.text) {
          setOcrText(res.text);
          if (res.cnj) setCnj(res.cnj);
          toast({ title: "Texto importado", description: res.cnj || "Sem CNJ detectado" });
        }
        return;
      }

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = reject;
        r.readAsDataURL(file);
      });

      const res = await transcribeTribunalPrintAction({
        imageBase64: dataUrl,
        mimeType: file.type || "image/png",
      });

      if (res.success && res.text) {
        setOcrText(res.text);
        if (res.cnj) setCnj(res.cnj);
        toast({
          title: `Transcrição (${res.engine})`,
          description: res.cnj || "Revise o texto e o CNJ",
        });
        markDone("captura");
      } else {
        toast({
          title: "OCR falhou",
          description: res.error || "Cole o texto manualmente",
          variant: "destructive",
        });
      }
    } catch (e: any) {
      toast({ title: "Erro no print", description: e.message, variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  const runCaptura = async () => {
    if (cleanCnj.length !== 20) {
      toast({ title: "CNJ inválido", variant: "destructive" });
      return;
    }
    const preview = getTribunalByCnj(cnj);
    if (preview?.url) {
      openEmbed(preview.url, `${preview.sigla} · ${preview.sistema}`);
    }
    setLoading("captura");
    try {
      const res = await openTribunalViaGcloudAction(cnj, "fetch");
      if (res.openUrl) {
        openEmbed(
          res.openUrl,
          `${res.tribunal || preview?.sigla} · ${res.sistema || ""}`
        );
      }
      if (res.data) {
        setResultado({ success: true, data: res.data, note: res.message });
        const g =
          res.data["Primeiro Grau"] || res.data["Segundo Grau"];
        if (g?.partes?.[0]?.nome && !cliente) {
          setCliente(g.partes[0].nome);
        }
      }
      markDone("captura");
      toast({ title: "01 Captura", description: "Tribunal no app" });
      setStep("triagem");
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

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
      setStep("cadastro");
      toast({ title: "02 Triagem ok" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  /** 03 Cadastro DIRETO → aba Processos */
  const runCadastro = async () => {
    setLoading("cadastro");
    try {
      const res = await registerCaseFromAutomacaoAction({
        protocolo: cnj,
        cliente,
        telefone,
        tribunal: tribunalPreview?.sigla || "",
        classificacao,
        ofensor,
        observacao,
        textoTribunal: ocrText,
      });
      if (!res.success) {
        toast({
          title: "Cadastro falhou",
          description: res.error,
          variant: "destructive",
        });
        return;
      }
      markDone("cadastro");
      toast({
        title: res.created ? "Cadastrado na carteira" : "Atualizado na carteira",
        description: "Disponível na aba Processos",
      });
      setStep("classificacao");
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
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
            Pipeline 01–08 · print/OCR · cadastro na carteira · eproc SP · Custas subaba
          </p>
        </div>

        <div className="flex gap-2 border-b border-border">
          <button
            type="button"
            onClick={() => setTab("pipeline")}
            className={cn(
              "px-4 py-2.5 text-[11px] font-black uppercase tracking-widest rounded-t-xl border border-b-0",
              tab === "pipeline" ? "bg-card border-border" : "text-muted-foreground border-transparent"
            )}
          >
            Pipeline operacional
          </button>
          <button
            type="button"
            onClick={() => setTab("custas")}
            className={cn(
              "px-4 py-2.5 text-[11px] font-black uppercase tracking-widest rounded-t-xl border border-b-0",
              tab === "custas" ? "bg-card border-border" : "text-muted-foreground border-transparent"
            )}
          >
            Custas (TJSP)
          </button>
        </div>

        {tab === "pipeline" && (
          <div className="space-y-6">
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
                    <div className="flex items-center gap-1">
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
                {/* CNJ sempre nos primeiros passos */}
                {["captura", "triagem", "cadastro"].includes(step) && (
                  <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase">CNJ</Label>
                    <Input
                      value={cnj}
                      onChange={(e) => setCnj(e.target.value)}
                      placeholder="0000000-00.0000.8.26.0000"
                      className="font-mono h-12 text-lg"
                    />
                    {tribunalPreview && (
                      <div className="flex flex-wrap gap-2 text-[11px]">
                        <Badge className="font-black">{tribunalPreview.sigla}</Badge>
                        <Badge variant="outline" className="uppercase text-[9px]">
                          {tribunalPreview.sistema} principal
                        </Badge>
                      </div>
                    )}
                  </div>
                )}

                {/* —— 01 CAPTURA + PRINT —— */}
                {step === "captura" && (
                  <div className="space-y-4">
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
                        Capturar no app (eproc)
                      </Button>
                      {fallbacks.map((f, i) => (
                        <Button
                          key={i}
                          type="button"
                          variant="outline"
                          className="h-11"
                          onClick={() => openEmbed(f.url, f.label || f.sistema)}
                        >
                          {f.label || f.sistema}
                        </Button>
                      ))}
                    </div>

                    <div className="rounded-xl border border-dashed border-border p-4 space-y-3">
                      <p className="text-[11px] font-bold uppercase text-muted-foreground flex items-center gap-2">
                        <ImageIcon size={14} />
                        Print / screenshot do tribunal
                      </p>
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/*,.txt,.pdf"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) onPrintFile(f);
                          e.target.value = "";
                        }}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        className="gap-2 h-11"
                        disabled={!!loading}
                        onClick={() => fileRef.current?.click()}
                      >
                        {loading === "ocr" ? (
                          <Loader2 className="animate-spin h-4 w-4" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                        Enviar print e transcrever
                      </Button>
                      <Textarea
                        value={ocrText}
                        onChange={(e) => setOcrText(e.target.value)}
                        placeholder="Ou cole aqui o texto do tribunal / OCR…"
                        className="min-h-[100px] text-xs"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          if (!ocrText.trim()) return;
                          setLoading("ocr");
                          const res = await transcribeTribunalPrintAction({
                            text: ocrText,
                          });
                          setLoading(null);
                          if (res.cnj) {
                            setCnj(res.cnj);
                            toast({ title: "CNJ detectado", description: res.cnj });
                          }
                        }}
                      >
                        Detectar CNJ no texto
                      </Button>
                    </div>
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
                    Rodar triagem
                  </Button>
                )}

                {/* —— 03 CADASTRO DIRETO —— */}
                {step === "cadastro" && (
                  <div className="space-y-3 border rounded-xl p-4 bg-card">
                    <p className="text-sm text-muted-foreground">
                      Grava direto na carteira — aparece na aba <strong>Processos</strong>.
                    </p>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>Cliente *</Label>
                        <Input
                          value={cliente}
                          onChange={(e) => setCliente(e.target.value)}
                          placeholder="Nome completo"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Telefone</Label>
                        <Input
                          value={telefone}
                          onChange={(e) => setTelefone(e.target.value)}
                          placeholder="WhatsApp"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Classificação</Label>
                        <Input
                          value={classificacao}
                          onChange={(e) => setClassificacao(e.target.value)}
                          placeholder="Revisional, BA, cobrança…"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Ofensor</Label>
                        <Input
                          value={ofensor}
                          onChange={(e) => setOfensor(e.target.value)}
                          placeholder="Banco / financeira"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>Observações</Label>
                      <Textarea
                        value={observacao}
                        onChange={(e) => setObservacao(e.target.value)}
                        className="min-h-[80px]"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={runCadastro}
                        disabled={!!loading || !cliente.trim()}
                        className="h-11 font-bold gap-2"
                      >
                        {loading === "cadastro" ? (
                          <Loader2 className="animate-spin h-4 w-4" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        Registrar na carteira (Processos)
                      </Button>
                      <Button asChild variant="outline" className="h-11">
                        <Link
                          href={`/cases?search=${encodeURIComponent(cnj || "")}`}
                        >
                          Abrir em Processos <ChevronRight size={14} />
                        </Link>
                      </Button>
                    </div>
                  </div>
                )}

                {step === "classificacao" && (
                  <div className="space-y-3">
                    <Input
                      value={classificacao}
                      onChange={(e) => setClassificacao(e.target.value)}
                      placeholder="Serviço / produto"
                    />
                    <Input
                      value={ofensor}
                      onChange={(e) => setOfensor(e.target.value)}
                      placeholder="Ofensor"
                    />
                    <Button
                      onClick={() => {
                        markDone("classificacao");
                        setStep("demanda");
                      }}
                    >
                      Avançar
                    </Button>
                  </div>
                )}

                {step === "demanda" && (
                  <div className="space-y-3">
                    <Textarea
                      value={insumos}
                      onChange={(e) => setInsumos(e.target.value)}
                      placeholder="Insumos para acordo/defesa…"
                      className="min-h-[100px]"
                    />
                    <Button
                      onClick={() => {
                        markDone("demanda");
                        setStep("analise");
                      }}
                    >
                      Avançar
                    </Button>
                  </div>
                )}

                {step === "analise" && (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Análise estilo FIRAC (fatos / questões / regras) — inspirado em pipelines
                      de IA jurídica; sem inventar dados.
                    </p>
                    <Textarea
                      value={firacNotes}
                      onChange={(e) => setFiracNotes(e.target.value)}
                      placeholder="Fatos:&#10;Questões:&#10;Riscos:&#10;Estratégia:"
                      className="min-h-[120px] text-xs"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button asChild variant="secondary" className="gap-2">
                        <Link href="/veredito">
                          <FileSearch size={16} /> Veredito
                        </Link>
                      </Button>
                      <Button
                        onClick={() => {
                          markDone("analise");
                          setStep("devolutiva");
                        }}
                      >
                        Análise ok
                      </Button>
                    </div>
                  </div>
                )}

                {step === "devolutiva" && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Rascunhos leigos: Tarefas / Processos → Sugerir resposta (Lexis + IA).
                    </p>
                    <Button asChild className="gap-2">
                      <Link
                        href={`/tarefas?search=${encodeURIComponent(cnj || "")}`}
                      >
                        <Sparkles size={16} /> Fila / sugestões
                      </Link>
                    </Button>
                    <Button
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
                    <Button asChild variant="outline">
                      <Link href="/notes">Notas</Link>
                    </Button>
                    <Button
                      onClick={() => {
                        markDone("recomendacoes");
                        toast({ title: "Pipeline finalizado nesta sessão" });
                      }}
                    >
                      Finalizar
                    </Button>
                  </div>
                )}

                {embedUrl && (
                  <div className="rounded-xl border-2 border-primary/30 overflow-hidden bg-white">
                    <div className="h-11 flex items-center justify-between px-2 bg-muted/60 border-b gap-2">
                      <span className="text-[10px] font-bold truncate px-2">
                        {embedTitle}
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
                      <AlertCircle size={12} className="mt-0.5 shrink-0" />
                      Embed no app. Se ficar branco, use nova aba. SP = eproc principal.
                    </p>
                  </div>
                )}

                {grau?.movimentações?.length > 0 && (
                  <div className="space-y-2 max-h-48 overflow-auto border rounded-xl p-3">
                    {grau.movimentações.slice(0, 10).map((m: any, i: number) => (
                      <div key={i} className="text-sm border-b pb-2">
                        <span className="text-xs text-muted-foreground">{m.data}</span>
                        <p>{m.descricao}</p>
                      </div>
                    ))}
                  </div>
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
              <Button
                className="bg-amber-600 hover:bg-amber-700"
                onClick={() => {
                  if (custasCnj) doCopy("CNJ", custasCnj);
                  openEmbed(PORTAL_CUSTAS_TJSP, "Portal de Custas");
                }}
              >
                Abrir portal no app
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
