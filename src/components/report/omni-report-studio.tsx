"use client";

import React, { useRef, useState } from "react";
import {
  Download,
  ExternalLink,
  FileArchive,
  FileText,
  Image as ImageIcon,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  extractOmniReportFileAction,
  generateOmniReportAction,
  renderOmniReportPdfAction,
  type OmniReportSource,
} from "@/app/actions/omni-report-action";

type ImageInput = {
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  data: string;
  name: string;
};

type Generated = {
  html: string;
  markdown: string;
  title: string;
  filenameBase: string;
  sources: Array<{ id: string; name: string; kind: string; chars: number }>;
  stats: {
    inputChars: number;
    chunks: number;
    cnjs: number;
    sections: number;
    engines: string[];
  };
};

function downloadBlob(content: BlobPart, mime: string, filename: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function downloadBase64(base64: string, mime: string, filename: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  downloadBlob(bytes, mime, filename);
}

export function OmniReportStudio() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [instruction, setInstruction] = useState("");
  const [sources, setSources] = useState<OmniReportSource[]>([]);
  const [images, setImages] = useState<ImageInput[]>([]);
  const [detail, setDetail] = useState<"normal" | "profundo" | "maximo">("maximo");
  const [executionMode, setExecutionMode] = useState<"local_gratis" | "ia_online">("local_gratis");
  const [readingFiles, setReadingFiles] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [error, setError] = useState("");
  const [generated, setGenerated] = useState<Generated | null>(null);

  const addFiles = async (files: FileList | File[]) => {
    const list = Array.from(files || []);
    if (!list.length) return;
    setReadingFiles(true);
    setError("");
    try {
      for (const file of list.slice(0, 12)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await extractOmniReportFileAction(fd);
        if (!res.success) {
          setError((prev) =>
            [prev, file.name + ": " + (res.error || "falha na leitura")]
              .filter(Boolean)
              .join("\n")
          );
          continue;
        }
        if ("image" in res && res.image) {
          setImages((prev) => [
            ...prev,
            {
              ...res.image,
              name: res.name,
            },
          ]);
        } else if ("text" in res && res.text) {
          setSources((prev) => [
            ...prev,
            {
              name: res.name,
              kind: res.kind,
              text: res.text,
            },
          ]);
        }
      }
    } finally {
      setReadingFiles(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const generate = async () => {
    if (!instruction.trim() && !sources.length && !images.length) {
      setError("Descreva o que precisa ou envie algum material.");
      return;
    }
    setGenerating(true);
    setGenerated(null);
    setError("");
    try {
      const res = await generateOmniReportAction({
        instruction,
        sources,
        images: images.map(({ mediaType, data }) => ({ mediaType, data })),
        detail,
        executionMode,
      });
      if (!res.success) {
        setError(res.error || "Falha ao gerar relatório.");
        return;
      }
      setGenerated({
        html: res.html,
        markdown: res.markdown,
        title: res.title,
        filenameBase: res.filenameBase,
        sources: res.sources,
        stats: res.stats,
      });
    } catch (e: any) {
      setError(e?.message || "Falha ao gerar relatório.");
    } finally {
      setGenerating(false);
    }
  };

  const downloadPdf = async () => {
    if (!generated) return;
    setPdfBusy(true);
    setError("");
    try {
      const res = await renderOmniReportPdfAction(
        generated.html,
        generated.filenameBase
      );
      if (!res.success) {
        setError(res.error || "Falha ao gerar PDF.");
        return;
      }
      downloadBase64(res.base64, res.mime, res.filename);
    } catch (e: any) {
      setError(e?.message || "Falha ao gerar PDF.");
    } finally {
      setPdfBusy(false);
    }
  };

  const openHtml = () => {
    if (!generated) return;
    const blob = new Blob([generated.html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  return (
    <section className="print:hidden overflow-hidden rounded-3xl border border-[#cfdcf0] bg-card shadow-[0_18px_60px_rgba(22,60,105,.10)]">
      <div className="border-b border-border bg-[linear-gradient(135deg,#061d35,#0b4777)] p-5 text-white sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.18em] text-[#9fd3ff]">
              <Sparkles className="h-4 w-4" />
              OmniReport
            </div>
            <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
              Diga o que você precisa. O Lexis monta o dossiê.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#cae2f6]">
              Cole mensagens, teor do processo, anotações ou apenas um CNJ.
              Também aceita PDF, DOCX, planilhas, CSV, TXT, JSON, HTML e imagens.
              No modo gratuito cruza os registros da carteira já sincronizados. A consulta ao tribunal em tempo real e a análise neural exigem selecionar o modo online.
            </p>
          </div>

          <div className="grid min-w-[220px] grid-cols-3 gap-1 rounded-2xl border border-white/10 bg-white/5 p-1">
            {[
              ["normal", "Rápido"],
              ["profundo", "Profundo"],
              ["maximo", "Máximo"],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setDetail(id as any)}
                className={
                  "rounded-xl px-2 py-2 text-[10px] font-black uppercase transition " +
                  (detail === id
                    ? "bg-white text-[#0b3457]"
                    : "text-[#b9d4ea] hover:bg-white/10")
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <label className="text-[10px] font-black uppercase tracking-[.14em] text-muted-foreground">
            Contexto / pedido
          </label>
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder={
              "Exemplos:\n" +
              "• Faça uma auditoria completa deste processo 0000000-00.0000.0.00.0000 e diga tudo que deu errado.\n" +
              "• Essas mensagens são de uma transição de carteira; monte um dossiê por pessoa e por fase.\n" +
              "• Analise estes PDFs e a planilha, reconcilie contradições e gere um relatório extremamente detalhado.\n\n" +
              "Você pode escrever do seu jeito. Não precisa preencher formulário jurídico."
            }
            className="mt-2 min-h-[220px] w-full resize-y rounded-2xl border border-border bg-background p-4 text-sm leading-relaxed outline-none transition focus:border-primary"
          />

          <div className="mt-3 grid gap-2 rounded-xl border border-border bg-muted/40 p-3 sm:grid-cols-2" role="group" aria-label="Modo do OmniReport">
            <button type="button" onClick={() => setExecutionMode("local_gratis")}
              aria-pressed={executionMode === "local_gratis"}
              className={"rounded-lg border px-3 py-2 text-left text-xs transition " + (executionMode === "local_gratis" ? "border-primary bg-background font-bold text-foreground" : "border-transparent text-muted-foreground hover:bg-background/70")}>
              Local grátis · sem créditos
              <span className="mt-1 block text-[10px] font-normal">Relatório documental rastreável, sem LLM e sem consulta judicial nova.</span>
            </button>
            <button type="button" onClick={() => setExecutionMode("ia_online")}
              aria-pressed={executionMode === "ia_online"}
              className={"rounded-lg border px-3 py-2 text-left text-xs transition " + (executionMode === "ia_online" ? "border-primary bg-background font-bold text-foreground" : "border-transparent text-muted-foreground hover:bg-background/70")}>
              IA online · opcional
              <span className="mt-1 block text-[10px] font-normal">Usa provedores disponíveis; se falharem, retorna relatório documental.</span>
            </button>
          </div>
          {executionMode === "local_gratis" && images.length > 0 ? (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300" role="status">
              Imagens anexadas serão listadas, mas não transcritas neste modo. Para analisar o conteúdo visual, use um motor de visão disponível ou transcreva o texto.
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={readingFiles}
              className="h-11 rounded-xl font-bold"
            >
              {readingFiles ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Adicionar material
            </Button>
            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              accept=".pdf,.docx,.xlsx,.xls,.xlsm,.csv,.txt,.md,.json,.html,.htm,.xml,.log,image/jpeg,image/png,image/gif,image/webp"
              onChange={(e) => {
                if (e.target.files) void addFiles(e.target.files);
              }}
            />
            <Button
              type="button"
              onClick={() => void generate()}
              disabled={generating || readingFiles}
              className="h-11 rounded-xl px-5 font-black"
            >
              {generating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {generating ? "Organizando fontes…" : executionMode === "local_gratis" ? "Gerar dossiê grátis" : "Gerar dossiê com IA"}
            </Button>
          </div>

          {error ? (
            <pre className="mt-3 whitespace-pre-wrap rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-relaxed text-red-700">
              {error}
            </pre>
          ) : null}
        </div>

        <div className="rounded-2xl border border-border bg-muted/30 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black text-foreground">Fontes</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {sources.length + images.length} material(is)
              </p>
            </div>
            {sources.length + images.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setSources([]);
                  setImages([]);
                }}
                className="rounded-lg p-2 text-muted-foreground hover:bg-background hover:text-destructive"
                title="Remover todos"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <div className="mt-3 max-h-[280px] space-y-2 overflow-y-auto">
            {sources.map((source, index) => (
              <div
                key={source.name + index}
                className="flex items-center gap-2 rounded-xl border border-border bg-background p-2.5"
              >
                <FileText className="h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-bold">{source.name}</p>
                  <p className="text-[9px] text-muted-foreground">
                    {source.kind || "texto"} · {source.text.length.toLocaleString("pt-BR")} caracteres
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setSources((prev) => prev.filter((_, i) => i !== index))
                  }
                  className="rounded-md p-1 text-muted-foreground hover:text-destructive"
                  aria-label={"Remover " + source.name}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            {images.map((image, index) => (
              <div
                key={image.name + index}
                className="flex items-center gap-2 rounded-xl border border-border bg-background p-2.5"
              >
                <ImageIcon className="h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-bold">{image.name}</p>
                  <p className="text-[9px] text-muted-foreground">imagem · visão IA</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setImages((prev) => prev.filter((_, i) => i !== index))
                  }
                  className="rounded-md p-1 text-muted-foreground hover:text-destructive"
                  aria-label={"Remover " + image.name}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            {!sources.length && !images.length ? (
              <div className="rounded-xl border border-dashed border-border p-5 text-center">
                <FileArchive className="mx-auto h-6 w-6 text-muted-foreground/50" />
                <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
                  Nenhum arquivo ainda. Um CNJ ou texto colado já é suficiente para começar.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {generated ? (
        <div className="border-t border-border bg-[#f5f8fc] p-4 sm:p-6">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-black text-[#102447]">{generated.title}</p>
              <p className="mt-1 text-[10px] text-[#6d7f9b]">
                {generated.stats.inputChars.toLocaleString("pt-BR")} caracteres ·{" "}
                {generated.stats.chunks} blocos · {generated.stats.sections} seções ·{" "}
                {generated.stats.cnjs} CNJ(s)
              </p>
              <p className="mt-1 max-w-3xl truncate text-[9px] text-[#8a9bb1]">
                Motores: {generated.stats.engines.join(" · ")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadBlob(
                    generated.html,
                    "text/html;charset=utf-8",
                    generated.filenameBase + ".html"
                  )
                }
                className="h-10 rounded-xl text-xs font-bold"
              >
                <Download className="mr-2 h-4 w-4" />
                HTML
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={openHtml}
                className="h-10 rounded-xl text-xs font-bold"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Abrir
              </Button>
              <Button
                type="button"
                onClick={() => void downloadPdf()}
                disabled={pdfBusy}
                className="h-10 rounded-xl text-xs font-black"
              >
                {pdfBusy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                PDF
              </Button>
            </div>
          </div>

          <iframe
            title="Prévia do OmniReport"
            srcDoc={generated.html}
            sandbox="allow-scripts"
            className="h-[70vh] w-full rounded-2xl border border-[#cfdcf0] bg-white"
          />
        </div>
      ) : null}
    </section>
  );
}
