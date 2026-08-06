"use client";

/**
 * Assistente IA Lexis — Claude/OmniRoute, thinking visivel, PDF + imagens.
 */

import { PromptLibraryPanel } from "@/components/ai/prompt-library";
import { AiInstructionsPanel, buildInstructionsPrefix } from "@/components/ai/ai-instructions";
import { Typewriter } from "@/components/ui/typewriter";


import React, { useState, useRef, useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Send,
  Bot,
  User,
  Loader2,
  Copyright,
  ImagePlus,
  FileText,
  Brain,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  perguntarChatbotIndependente,
  extractPdfTextForChatAction,
} from "@/app/chatbot-separado/actions";
import { MotorSelector } from "@/components/ai/motor-selector";
import {
  loadPreferredMotor,
  MotorId,
  extractCnjFromText,
  loadBaClaudeDjenEnabled,
  saveBaClaudeDjenEnabled,
} from "@/lib/ai/motors";
import { DataJudDisclaimer } from "@/components/ui/datajud-disclaimer";
import { cn } from "@/lib/utils";

function splitThinking(raw: string): { thinking: string | null; answer: string } {
  const t = String(raw || "");
  const thinkM = t.match(/<\s*thinking\s*>([\s\S]*?)<\s*\/\s*thinking\s*>/i);
  const ansM = t.match(/<\s*answer\s*>([\s\S]*?)<\s*\/\s*answer\s*>/i);
  if (ansM || thinkM) {
    return {
      thinking: thinkM ? thinkM[1].trim() : null,
      answer: (ansM ? ansM[1] : t.replace(/<\s*thinking\s*>[\s\S]*?<\s*\/\s*thinking\s*>/i, ""))
        .replace(/<\/?\s*(thinking|answer)\s*>/gi, "")
        .trim(),
    };
  }
  return { thinking: null, answer: t };
}

type Msg = {
  role: "user" | "assistant";
  content: string;
  thinking?: string | null;
  engine?: string;
};

function ThinkingBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mb-2 rounded-xl border border-violet-500/30 bg-violet-500/5 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-violet-700 dark:text-violet-300"
      >
        <Brain size={12} />
        Pensamento
        {open ? <ChevronDown size={12} className="ml-auto" /> : <ChevronRight size={12} className="ml-auto" />}
      </button>
      {open ? (
        <pre className="px-3 pb-3 text-[11px] leading-relaxed whitespace-pre-wrap text-muted-foreground font-sans max-h-48 overflow-auto">
          {text}
        </pre>
      ) : null}
    </div>
  );
}

export default function AssistentePage() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Assistente Lexis (Claude via OmniRoute). Pergunte qualquer coisa. Anexe PDF ou imagem — leio o teor, mostro o raciocínio quando fizer sentido e respondo de forma clara.",
    },
  ]);
  const [input, setInput] = useState("");
  const [activeInstructions, setActiveInstructions] = useState<string[]>(["conciso", "cliente"]);
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState<MotorId>("claude");
  const [baClaude, setBaClaude] = useState(false);
  const [pendingImage, setPendingImage] = useState<{
    mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
    data: string;
  } | null>(null);
  const [pendingPdf, setPendingPdf] = useState<{ name: string; text: string; chars: number } | null>(
    null
  );
  const [pdfLoading, setPdfLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setModel(loadPreferredMotor());
    setBaClaude(loadBaClaudeDjenEnabled());
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const onImage = async (file: File | null) => {
    if (!file || !file.type.startsWith("image/")) return;
    const buf = await file.arrayBuffer();
    const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    setPendingImage({ mediaType: (file.type as any) || "image/png", data: b64 });
  };

  const onPdf = async (file: File | null) => {
    if (!file) return;
    setPdfLoading(true);
    try {
      const fd = new FormData();
      fd.append("pdf", file);
      const res = await extractPdfTextForChatAction(fd);
      if (!res.success) {
        setMessages((m) => [
          ...m,
          { role: "assistant", content: `PDF: ${(res as any).error || "falha na leitura"}` },
        ]);
        return;
      }
      setPendingPdf({ name: res.name, text: res.text, chars: res.chars });
    } finally {
      setPdfLoading(false);
      if (pdfRef.current) pdfRef.current.value = "";
    }
  };

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = (buildInstructionsPrefix(activeInstructions) + input.trim()).trim();
    const displayText = input.trim();
    if ((!text && !pendingImage && !pendingPdf) || loading) return;

    const userLabel = [
      text || (pendingPdf ? `(PDF: ${pendingPdf.name})` : "") || "(anexo)",
      pendingImage ? "[imagem]" : "",
      pendingPdf ? `[pdf ${pendingPdf.chars} chars]` : "",
    ]
      .filter(Boolean)
      .join(" ");

    setMessages((m) => [...m, { role: "user", content: userLabel.includes("data:") ? userLabel : (displayText || userLabel) }]);
    setInput("");
    const img = pendingImage;
    const pdf = pendingPdf;
    setPendingImage(null);
    setPendingPdf(null);
    setLoading(true);

    try {
      const history = messages
        .filter((x) => x.role === "user" || x.role === "assistant")
        .slice(-12)
        .map((x) => ({ role: x.role, content: x.content }));

      const res = await perguntarChatbotIndependente(text || "Analise o material anexado.", history, model, {
        baClaudeDjen: baClaude,
        images: img ? [img] : undefined,
        pdfText: pdf?.text,
        pdfName: pdf?.name,
        max_tokens: 4096,
      });

      const raw = res.resposta || "Sem resposta.";
      const fromServer = (res as any).thinking as string | null;
      const split = splitThinking(raw);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: split.answer || raw.replace(/<\/?\s*(thinking|answer)\s*>/gi, "").trim(),
          thinking: fromServer || split.thinking,
          engine: res.engineUtilizada || res.engine,
        },
      ]);
    } catch (err: any) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `Erro: ${err?.message || err}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="shrink-0 border-b px-4 py-3 flex flex-wrap items-center gap-3 bg-card/40">
          <div className="flex items-center gap-2">
            <Bot className="text-primary" size={20} />
            <div>
              <h1 className="text-sm font-black uppercase tracking-widest">Assistente IA</h1>
              <p className="text-[10px] text-muted-foreground font-bold uppercase">
                Claude · OmniRoute · PDF · Vision · Pensamento visível
              </p>
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <MotorSelector value={model} onChange={setModel} />
            <div className="flex items-center gap-2">
              <Switch
                id="chat-ba-claude"
                checked={baClaude}
                onCheckedChange={(v) => {
                  setBaClaude(v);
                  saveBaClaudeDjenEnabled(v);
                }}
              />
              <Label htmlFor="chat-ba-claude" className="text-[10px] font-bold">
                BA + Claude/DJEN
              </Label>
            </div>
          </div>
        </header>

        <ScrollArea className="flex-1 px-4 py-6">
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "flex gap-3",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {msg.role === "assistant" ? (
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot size={16} className="text-primary" />
                  </div>
                ) : null}
                <div
                  className={cn(
                    "rounded-2xl px-4 py-3 max-w-[85%] text-sm leading-relaxed",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary/80 border border-border/50"
                  )}
                >
                  {msg.role === "assistant" && msg.thinking ? (
                    <ThinkingBlock text={msg.thinking} />
                  ) : null}
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                  {msg.role === "assistant" && msg.engine ? (
                    <p className="mt-2 text-[9px] font-mono text-muted-foreground opacity-70">
                      {msg.engine}
                    </p>
                  ) : null}
                </div>
                {msg.role === "user" ? (
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <User size={16} />
                  </div>
                ) : null}
              </div>
            ))}
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <Loader2 className="animate-spin" size={14} />
                Claude está pensando…
              </div>
            ) : null}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        <form onSubmit={send} className="shrink-0 border-t border-border p-4 sm:px-6 bg-card/50">
          {(pendingImage || pendingPdf) && (
            <div className="max-w-3xl mx-auto mb-2 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
              {pendingImage && (
                <span className="flex items-center gap-1">
                  <ImagePlus size={12} /> Print anexado
                  <button type="button" className="underline" onClick={() => setPendingImage(null)}>
                    remover
                  </button>
                </span>
              )}
              {pendingPdf && (
                <span className="flex items-center gap-1">
                  <FileText size={12} /> PDF {pendingPdf.name} ({pendingPdf.chars} chars)
                  <button type="button" className="underline" onClick={() => setPendingPdf(null)}>
                    remover
                  </button>
                </span>
              )}
            </div>
          )}
          
            <div className="flex flex-wrap items-center gap-2 px-1 pb-2">
              <PromptLibraryPanel onInsert={(t) => setInput((prev) => (prev ? prev + "\n" + t : t))} />
              <AiInstructionsPanel value={activeInstructions} onChange={setActiveInstructions} />
              <p className="text-[10px] text-muted-foreground ml-auto hidden sm:block">
                <Typewriter texts={["Resuma o processo…", "Explique o DJEN…", "Rascunho WhatsApp…"]} baseText="Ex.: " delay={1.2} />
              </p>
            </div>
<div className="max-w-3xl mx-auto flex gap-2">
            <input
              ref={imgRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onImage(e.target.files?.[0] || null)}
            />
            <input
              ref={pdfRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => onPdf(e.target.files?.[0] || null)}
            />
            <Button
              type="button"
              variant="outline"
              className="h-12 w-12 rounded-xl shrink-0"
              onClick={() => imgRef.current?.click()}
              title="Anexar imagem"
            >
              <ImagePlus size={18} />
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-12 w-12 rounded-xl shrink-0"
              onClick={() => pdfRef.current?.click()}
              disabled={pdfLoading}
              title="Anexar PDF"
            >
              {pdfLoading ? <Loader2 className="animate-spin" size={18} /> : <FileText size={18} />}
            </Button>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte qualquer coisa do gabinete… ou anexe PDF/print"
              className="h-12 rounded-xl"
              disabled={loading}
            />
            <Button
              type="submit"
              disabled={loading || (!input.trim() && !pendingImage && !pendingPdf)}
              className="h-12 px-5 rounded-xl shrink-0"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
            </Button>
          </div>
          <p className="max-w-3xl mx-auto mt-2 text-[10px] text-muted-foreground flex items-center gap-1">
            <Copyright size={10} /> Apoio operacional — revise antes de enviar ao cliente.
          </p>
          <div className="max-w-3xl mx-auto mt-2">
            <DataJudDisclaimer />
          </div>
        </form>
      </main>
    </div>
  );
}
