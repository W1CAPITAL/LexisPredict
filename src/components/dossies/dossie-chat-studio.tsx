"use client";

import React, { useRef, useState } from "react";
import {
  BookOpen,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  RotateCcw,
  Send,
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

type Result = {
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

type Turn =
  | { id: string; role: "assistant"; text: string; result?: Result }
  | { id: string; role: "user"; text: string; attachments: string[] };

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

const welcome: Turn = {
  id: "welcome",
  role: "assistant",
  text:
    "Me diga o dossiê que você quer. Pode escrever do seu jeito e anexar PDF, Excel, DOCX, CSV, TXT, prints ou mensagens. Se tiver um processo, basta informar o CNJ. Eu organizo as fontes, cruzo o que estiver disponível e preparo HTML/PDF.",
};

export function DossieChatStudio() {
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [turns, setTurns] = useState<Turn[]>([welcome]);
  const [prompt, setPrompt] = useState("");
  const [sources, setSources] = useState<OmniReportSource[]>([]);
  const [images, setImages] = useState<ImageInput[]>([]);
  const [reading, setReading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<Result | null>(null);
  const [error, setError] = useState("");

  const activeNames = [
    ...sources.map((s) => s.name),
    ...images.map((i) => i.name),
  ];

  const scrollBottom = () => {
    window.setTimeout(
      () => bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }),
      80,
    );
  };

  const addFiles = async (files: FileList | File[]) => {
    const list = Array.from(files || []);
    if (!list.length) return;
    setReading(true);
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
              .join("\n"),
          );
          continue;
        }
        if ("image" in res && res.image) {
          setImages((prev) => [...prev, { ...res.image, name: res.name }]);
        } else if ("text" in res && res.text) {
          setSources((prev) => [
            ...prev,
            { name: res.name, kind: res.kind, text: res.text },
          ]);
        }
      }
    } finally {
      setReading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const reset = () => {
    setTurns([welcome]);
    setPrompt("");
    setSources([]);
    setImages([]);
    setPreview(null);
    setError("");
  };

  const send = async () => {
    const text = prompt.trim();
    if ((!text && !sources.length && !images.length) || generating) return;

    const userText =
      text ||
      "Analise integralmente o material anexado e gere um dossiê extremamente detalhado.";
    const attachments = activeNames.slice();
    setTurns((prev) => [
      ...prev,
      {
        id: "u-" + Date.now(),
        role: "user",
        text: userText,
        attachments,
      },
    ]);
    setPrompt("");
    setGenerating(true);
    setError("");
    scrollBottom();

    try {
      const previous = [...turns]
        .reverse()
        .find((turn): turn is Extract<Turn, { role: "assistant" }> =>
          turn.role === "assistant" && !!turn.result,
        );

      const contextualSources = [...sources];
      if (previous?.result?.markdown) {
        contextualSources.push({
          name: "Dossiê anterior da conversa",
          kind: "dossie_anterior",
          text: previous.result.markdown.slice(0, 180000),
        });
      }

      const res = await generateOmniReportAction({
        instruction: userText,
        sources: contextualSources,
        images: images.map(({ mediaType, data }) => ({ mediaType, data })),
        detail: "maximo",
      });

      if (!res.success) {
        setError(res.error || "Falha ao gerar o dossiê.");
        setTurns((prev) => [
          ...prev,
          {
            id: "a-error-" + Date.now(),
            role: "assistant",
            text: "Não consegui concluir esse dossiê. " + (res.error || "Tente novamente."),
          },
        ]);
        return;
      }

      const result: Result = {
        html: res.html,
        markdown: res.markdown,
        title: res.title,
        filenameBase: res.filenameBase,
        sources: res.sources,
        stats: res.stats,
      };
      setPreview(result);
      setTurns((prev) => [
        ...prev,
        {
          id: "a-" + Date.now(),
          role: "assistant",
          text:
            "Dossiê pronto. Cruzei " +
            result.sources.length +
            " fonte(s), processei " +
            result.stats.inputChars.toLocaleString("pt-BR") +
            " caracteres e montei " +
            result.stats.sections +
            " seções. Você pode abrir, baixar ou continuar a conversa pedindo outra lente, correção, comparação ou aprofundamento.",
          result,
        },
      ]);
    } catch (e: any) {
      const message = e?.message || "Falha ao gerar o dossiê.";
      setError(message);
      setTurns((prev) => [
        ...prev,
        {
          id: "a-error-" + Date.now(),
          role: "assistant",
          text: "Não consegui concluir esse dossiê. " + message,
        },
      ]);
    } finally {
      setGenerating(false);
      scrollBottom();
    }
  };

  const openHtml = (result: Result) => {
    const blob = new Blob([result.html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const downloadPdf = async (result: Result) => {
    setPdfBusy(result.filenameBase);
    setError("");
    try {
      const res = await renderOmniReportPdfAction(result.html, result.filenameBase);
      if (!res.success) {
        setError(res.error || "Falha ao gerar PDF.");
        return;
      }
      downloadBase64(res.base64, res.mime, res.filename);
    } catch (e: any) {
      setError(e?.message || "Falha ao gerar PDF.");
    } finally {
      setPdfBusy(null);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border/70 bg-card px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#1769ff,#00a8ff)] text-white shadow-[0_10px_24px_rgba(23,105,255,.25)]">
              <BookOpen className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-black tracking-tight text-[#102447] sm:text-xl">
                Dossiês
              </h1>
              <p className="truncate text-[11px] text-muted-foreground">
                Peça por chat · processo, PDF, planilha, mensagens, prints ou contexto
              </p>
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={reset} className="rounded-xl">
            <RotateCcw className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Novo dossiê</span>
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-[#f5f8fc] px-3 py-5 sm:px-5">
        <div className="mx-auto max-w-4xl space-y-4">
          {turns.map((turn) => {
            const mine = turn.role === "user";
            return (
              <div key={turn.id} className={mine ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={
                    "max-w-[94%] rounded-2xl px-4 py-3 shadow-sm sm:max-w-[82%] " +
                    (mine
                      ? "bg-[#1769ff] text-white"
                      : "border border-[#dce6f3] bg-white text-[#26384f]")
                  }
                >
                  {!mine ? (
                    <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[.12em] text-[#1769ff]">
                      <Sparkles className="h-3.5 w-3.5" />
                      Lexis OmniReport
                    </div>
                  ) : null}
                  <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{turn.text}</p>

                  {mine && turn.attachments.length ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {turn.attachments.map((name) => (
                        <span
                          key={name}
                          className="max-w-full truncate rounded-lg bg-white/15 px-2 py-1 text-[9px] font-bold"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {!mine && turn.result ? (
                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setPreview(turn.result || null);
                          openHtml(turn.result!);
                        }}
                        className="h-9 rounded-xl text-[11px] font-bold"
                      >
                        <ExternalLink className="mr-2 h-3.5 w-3.5" />
                        Abrir HTML
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          downloadBlob(
                            turn.result!.html,
                            "text/html;charset=utf-8",
                            turn.result!.filenameBase + ".html",
                          )
                        }
                        className="h-9 rounded-xl text-[11px] font-bold"
                      >
                        <Download className="mr-2 h-3.5 w-3.5" />
                        Baixar HTML
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void downloadPdf(turn.result!)}
                        disabled={pdfBusy === turn.result.filenameBase}
                        className="h-9 rounded-xl text-[11px] font-black"
                      >
                        {pdfBusy === turn.result.filenameBase ? (
                          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="mr-2 h-3.5 w-3.5" />
                        )}
                        PDF
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}

          {generating ? (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-[#dce6f3] bg-white px-4 py-3 shadow-sm">
                <div className="flex items-center gap-3 text-[12px] font-bold text-[#3f5b7d]">
                  <Loader2 className="h-4 w-4 animate-spin text-[#1769ff]" />
                  Lendo fontes, cruzando evidências e montando o dossiê…
                </div>
              </div>
            </div>
          ) : null}

          {preview ? (
            <div className="overflow-hidden rounded-2xl border border-[#cfdcf0] bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-[#e2e8f0] px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-black text-[#193b67]">Prévia · {preview.title}</p>
                  <p className="mt-0.5 text-[9px] text-[#7b8da5]">
                    {preview.sources.length} fontes · {preview.stats.sections} seções · {preview.stats.cnjs} CNJ(s)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="text-[10px] font-bold text-[#6d7f9b] hover:text-[#193b67]"
                >
                  Fechar prévia
                </button>
              </div>
              <iframe
                title="Prévia do dossiê"
                srcDoc={preview.html}
                sandbox="allow-scripts"
                className="h-[66vh] w-full bg-white"
              />
            </div>
          ) : null}

          {error ? (
            <pre className="whitespace-pre-wrap rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-relaxed text-red-700">
              {error}
            </pre>
          ) : null}

          <div ref={bottomRef} />
        </div>
      </div>

      <div className="shrink-0 border-t border-border/70 bg-card p-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] sm:p-4">
        <div className="mx-auto max-w-4xl">
          {activeNames.length ? (
            <div className="mb-2 flex items-center gap-2 overflow-x-auto pb-1">
              <span className="shrink-0 text-[9px] font-black uppercase tracking-[.12em] text-muted-foreground">
                Base ativa
              </span>
              {sources.map((source, index) => (
                <button
                  key={source.name + index}
                  type="button"
                  onClick={() => setSources((prev) => prev.filter((_, i) => i !== index))}
                  title="Remover fonte"
                  className="flex max-w-[210px] shrink-0 items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2 py-1 text-[9px] font-bold text-muted-foreground"
                >
                  {source.kind === "planilha" ? (
                    <FileSpreadsheet className="h-3 w-3" />
                  ) : (
                    <FileText className="h-3 w-3" />
                  )}
                  <span className="truncate">{source.name}</span>
                  <Trash2 className="h-3 w-3" />
                </button>
              ))}
              {images.map((image, index) => (
                <button
                  key={image.name + index}
                  type="button"
                  onClick={() => setImages((prev) => prev.filter((_, i) => i !== index))}
                  title="Remover imagem"
                  className="flex max-w-[210px] shrink-0 items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2 py-1 text-[9px] font-bold text-muted-foreground"
                >
                  <ImageIcon className="h-3 w-3" />
                  <span className="truncate">{image.name}</span>
                  <Trash2 className="h-3 w-3" />
                </button>
              ))}
            </div>
          ) : null}

          <div className="flex items-end gap-2 rounded-2xl border border-[#cfdcf0] bg-background p-2 shadow-[0_8px_28px_rgba(23,57,94,.08)] focus-within:border-[#6ea4ff]">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={reading || generating}
              className="flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Anexar arquivos"
            >
              {reading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
            </button>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              accept=".pdf,.docx,.xlsx,.xls,.xlsm,.csv,.txt,.md,.json,.html,.htm,.xml,.log,image/jpeg,image/png,image/gif,image/webp"
              onChange={(e) => {
                if (e.target.files) void addFiles(e.target.files);
              }}
            />
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="Ex.: Analise o processo 5000628-05.2025.8.13.0481 e estes PDFs. Faça um dossiê completo, encontre contradições e diga o que poderia ter mudado o resultado."
              className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-1 py-2 text-[13px] leading-relaxed outline-none placeholder:text-muted-foreground/70"
              rows={1}
            />
            <Button
              type="button"
              onClick={() => void send()}
              disabled={generating || reading || (!prompt.trim() && !activeNames.length)}
              className="h-10 w-10 shrink-0 rounded-xl p-0"
              aria-label="Enviar pedido"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="mt-1.5 px-1 text-[9px] leading-relaxed text-muted-foreground">
            O Lexis diferencia evidência, relato, indício e hipótese. O dossiê anterior entra no contexto quando você pede uma continuação.
          </p>
        </div>
      </div>
    </div>
  );
}
