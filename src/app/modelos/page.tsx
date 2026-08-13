"use client";

/**
 * D3 — Modelos & Peças: biblioteca reutilizável de procurações, habilitações,
 * substabelecimentos, revogações, petições e cartas a bancos.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import React, { useMemo, useRef, useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ScrollText, Loader2, Copy, FileText, Library, Download, Upload } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import {
  extrairTextoDePdf,
  extrairCamposDoTexto,
} from "@/lib/pecas-pdf-extract";
import { gerarPecaTextoPDFAction } from "@/app/actions/document-actions";
import { downloadBase64File } from "@/lib/download-export";
import {
  MODELOS_DE_PECAS,
  CATEGORIAS,
  BANCOS_COBERTOS,
  renderModelo,
  type PecaMeta,
  type ModeloPeca,
  type CategoriaPeca,
} from "@/lib/pecas-modelos";
import { validatePecaMeta, validatePecaPreview } from "@/lib/pecas-validacao";

const CAMPOS_LABEL: Record<keyof PecaMeta, string> = {
  protocolo: "Processo / Contrato nº",
  cliente: "Nome completo (outorgante/cliente)",
  cpfCliente: "CPF",
  rgCliente: "RG",
  orgaoRgCliente: "Órgão expedidor do RG",
  nacionalidadeCliente: "Nacionalidade",
  estadoCivilCliente: "Estado civil",
  profissaoCliente: "Profissão",
  enderecoCliente: "Endereço completo",
  telefoneCliente: "Telefone",
  emailCliente: "E-mail",
  banco: "Banco / Instituição",
  cnpjBanco: "CNPJ do banco",
  advogado: "Advogado (outorgado)",
  oab: "OAB",
  uf: "UF da OAB",
  cpfAdvogado: "CPF do advogado",
  rgAdvogado: "RG do advogado",
  enderecoAdvogado: "Endereço profissional do advogado",
  advogado2: "2º advogado (opcional)",
  oab2: "OAB do 2º advogado",
  uf2: "UF OAB 2º",
  advogadoPassivo: "Advogado da parte contrária",
  tribunal: "Tribunal",
  comarca: "Comarca",
  orgao: "Órgão julgador",
  classeAcao: "Classe da ação",
  resumo: "Resumo / fundamentos / observações",
  substabDe: "Advogado cedente",
  substabDeOab: "OAB do cedente",
  substabPara: "Advogado substabelecido",
  substabParaOab: "OAB do substabelecido",
  tipoAcao: "Tipo / natureza da ação",
  data: "Data do documento",
  valorContrato: "Valor do contrato / saldo",
  valorProposta: "Valor da proposta",
  protocoloProcon: "Protocolo PROCON",
  cidade: "Cidade (local)",
  parteContraria: "Parte contrária (nome)",
  cpfParteContraria: "CPF da parte contrária",
};

export default function ModelosPage() {
  const { profile, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [categoria, setCategoria] = useState<CategoriaPeca | "Todas">("Todas");
  const [selected, setSelected] = useState<ModeloPeca | null>(null);
  const [meta, setMeta] = useState<PecaMeta>({});
  const [preview, setPreview] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [importingPdf, setImportingPdf] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Worker do PDF.js via CDN (mesmo padrão da página OCR).
    const v = pdfjsLib.version || "4.10.38";
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      `https://cdn.jsdelivr.net/npm/pdfjs-dist@${v}/build/pdf.worker.min.mjs`;
  }, []);

  const modelos = useMemo(
    () =>
      categoria === "Todas"
        ? MODELOS_DE_PECAS
        : MODELOS_DE_PECAS.filter((m) => m.categoria === categoria),
    [categoria]
  );

  const selectModelo = (m: ModeloPeca) => {
    setSelected(m);
    setMeta({});
    setPreview("");
  };

  const atualizarMeta = (k: keyof PecaMeta, v: string) => {
    setMeta((prev) => {
      const next = { ...prev, [k]: v };
      if (selected) setPreview(renderModelo(selected.id, next) || "");
      return next;
    });
  };

  const importarPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.type && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast({ title: "Arquivo inválido", description: "Envie um PDF.", variant: "destructive" });
      return;
    }
    setImportingPdf(true);
    try {
      const texto = await extrairTextoDePdf(await file.arrayBuffer());
      const limpo = texto.replace(/\s+/g, " ").trim();
      if (limpo.length < 20) {
        toast({
          title: "PDF sem camada de texto",
          description: "Parece escaneado/imagem. Use a ferramenta OCR e gere o texto antes de importar.",
          variant: "destructive",
        });
        return;
      }
      const campos = extrairCamposDoTexto(limpo);
      const qtd = Object.keys(campos).length;
      if (!qtd) {
        toast({ title: "Nada reconhecido", description: "Nenhum campo identificado neste PDF.", variant: "destructive" });
        return;
      }
      setMeta((prev) => {
        const next = { ...prev, ...campos };
        if (selected) setPreview(renderModelo(selected.id, next) || "");
        return next;
      });
      toast({
        title: "Campos preenchidos",
        description: `${qtd} campo(s) extraídos do PDF. Revise antes de gerar.`,
      });
    } catch (err: any) {
      toast({
        title: "Falha ao ler o PDF",
        description: err?.message || "Arquivo inválido ou corrompido.",
        variant: "destructive",
      });
    } finally {
      setImportingPdf(false);
    }
  };

  const gerar = () => {
    if (!selected) return;
    const issues = validatePecaMeta(selected, meta, { strictRequired: true });
    if (issues.length) {
      toast({
        title: "Complete os dados",
        description: issues[0].message,
        variant: "destructive",
      });
      // ainda mostra prévia para o usuário ver o que falta
    }
    const text = renderModelo(selected.id, meta) || "";
    setPreview(text);
    if (!issues.length) {
      toast({ title: "Prévia gerada", description: selected.titulo });
    }
  };

  const copy = async () => {
    if (!preview) return;
    try {
      await navigator.clipboard.writeText(preview);
      toast({ title: "Copiado", description: "Texto copiado para a área de transferência." });
    } catch {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
  };

  const gerarPDF = async () => {
    if (!selected) return;
    const metaIssues = validatePecaMeta(selected, meta, { strictRequired: true });
    if (metaIssues.length) {
      toast({ title: "Não foi possível gerar o PDF", description: metaIssues[0].message, variant: "destructive" });
      return;
    }
    let text = preview;
    if (!text?.trim()) {
      text = renderModelo(selected.id, meta) || "";
      setPreview(text);
    }
    const prevIssues = validatePecaPreview(text);
    if (prevIssues.length) {
      toast({ title: "Prévia incompleta", description: prevIssues[0].message, variant: "destructive" });
      return;
    }
    setPdfLoading(true);
    try {
      const preview = text;
      const res = await gerarPecaTextoPDFAction({ texto: preview, titulo: selected.titulo });
      if (!res?.success) throw new Error(res?.error || "Falha ao gerar PDF.");
      downloadBase64File(
        res.base64,
        `peca-${selected.id}.pdf`,
        "application/pdf"
      );
      toast({ title: "PDF gerado", description: "Peça baixada em PDF." });
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message || "Falha ao gerar PDF.", variant: "destructive" });
    } finally {
      setPdfLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Faça login para acessar.</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <main className="flex-1 min-h-0 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 space-y-6">
            <div>
              <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                <Library className="h-6 w-6 text-primary" /> Modelos & Peças
              </h1>
              <p className="text-xs text-muted-foreground">
                {MODELOS_DE_PECAS.length} modelos reutilizáveis · {BANCOS_COBERTOS.length} instituições financeiras cobertas
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(["Todas", ...CATEGORIAS] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategoria(c)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all",
                    categoria === c
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-primary/50"
                  )}
                >
                  {c}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {modelos.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => selectModelo(m)}
                  className={cn(
                    "text-left rounded-xl border p-3 transition-all shadow-sm",
                    selected?.id === m.id
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card hover:border-primary/40"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                    <p className="text-[11px] font-bold leading-tight">{m.titulo}</p>
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground line-clamp-2">{m.descricao}</p>
                </button>
              ))}
            </div>

            {selected && (
              <Card className="border-primary/30">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ScrollText className="h-4 w-4 text-primary" /> {selected.titulo}
                    <Badge variant="outline" className="ml-auto text-[9px] uppercase">{selected.categoria}</Badge>
                  </CardTitle>
                  <CardDescription className="text-xs">{selected.descricao}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-widest text-primary">
                          Importar dados de PDF
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Envie uma procuração, contrato ou certidão já preenchida para preencher os campos automaticamente.
                        </p>
                      </div>
                      <Button
                        metal={false}
                        size="sm"
                        variant="outline"
                        type="button"
                        onClick={() => pdfInputRef.current?.click()}
                        disabled={importingPdf || pdfLoading}
                      >
                        {importingPdf ? (
                          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="mr-1.5 h-4 w-4" />
                        )}
                        {importingPdf ? "Lendo PDF…" : "Escolher PDF"}
                      </Button>
                    </div>
                    <input
                      ref={pdfInputRef}
                      type="file"
                      accept="application/pdf,.pdf"
                      className="hidden"
                      onChange={importarPdf}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {selected.campos.map((k) => (
                      <div key={k} className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          {CAMPOS_LABEL[k]}
                        </Label>
                        {k === "banco" ? (
                          <select
                            value={meta.banco || ""}
                            onChange={(e) => atualizarMeta("banco", e.target.value)}
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                          >
                            <option value="">Selecione…</option>
                            {BANCOS_COBERTOS.map((b) => (
                              <option key={b} value={b}>{b}</option>
                            ))}
                          </select>
                        ) : k === "resumo" ? (
                          <Textarea rows={2} value={meta.resumo || ""} onChange={(e) => atualizarMeta("resumo", e.target.value)} placeholder="Observações / fundamentos" />
                        ) : (
                          <Input value={meta[k] || ""} onChange={(e) => atualizarMeta(k, e.target.value)} placeholder={CAMPOS_LABEL[k]} />
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button metal={false} size="sm" onClick={gerar}>
                      <ScrollText className="mr-1.5 h-4 w-4" /> Gerar texto
                    </Button>
                    {preview && (
                      <Button metal={false} size="sm" variant="outline" onClick={copy}>
                        <Copy className="mr-1.5 h-4 w-4" /> Copiar
                      </Button>
                    )}
                    {preview && (
                      <Button metal={false} size="sm" onClick={gerarPDF} disabled={pdfLoading}>
                        {pdfLoading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />} Baixar PDF
                      </Button>
                    )}
                  </div>

                  {preview && (
                    <Textarea readOnly value={preview} rows={18} className="font-serif text-xs leading-relaxed whitespace-pre-wrap" />
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
