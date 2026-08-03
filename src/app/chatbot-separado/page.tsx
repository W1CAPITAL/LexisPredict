/**
 * Chatbot independente + easter egg legível:
 * ao enviar URL mediari.app/analise, abre o site embutido no app (sem UI de “surpresa”).
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */
"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AnimatedIcon } from "@/components/ui/animated-icon";
import {
  Bot,
  Send,
  Loader2,
  X,
  ExternalLink,
  Sparkles,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { perguntarChatbotIndependente } from "./actions";

type Msg = { role: "user" | "assistant"; content: string };

const MEDIARI_ANALISE = "https://mediari.app/analise";

/** Detecta mediari.app/analise (com ou sem https, path parcial) */
function isMediariAnaliseUrl(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  // só a URL (mensagem quase só o link)
  const cleaned = t.replace(/\s+/g, " ");
  return (
    /^(https?:\/\/)?(www\.)?mediari\.app\/analise\/?(\s|$)/i.test(cleaned) ||
    cleaned === "mediari.app/analise" ||
    cleaned === "https://mediari.app/analise" ||
    cleaned === "http://mediari.app/analise"
  );
}

function normalizeMediariUrl(text: string): string {
  const t = text.trim();
  if (/^https?:\/\//i.test(t)) return t.split(/\s/)[0];
  return MEDIARI_ANALISE;
}

export default function ChatbotSeparadoPage() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Consultor estratégico pronto. Envie sua pergunta operacional ou jurídica.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState<"xai" | "groq">("xai");
  /** Easter egg: painel embutido (sem rótulo especial) */
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [embedExpanded, setEmbedExpanded] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, embedUrl]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    // ——— Easter egg silencioso: abre mediari no app
    if (isMediariAnaliseUrl(text)) {
      const url = normalizeMediariUrl(text);
      setInput("");
      setMessages((m) => [...m, { role: "user", content: text }]);
      setEmbedUrl(url);
      setEmbedExpanded(true);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: "Conteúdo carregado abaixo.",
        },
      ]);
      return;
    }

    setInput("");
    const history = [...messages, { role: "user" as const, content: text }];
    setMessages(history);
    setLoading(true);
    try {
      const res = await perguntarChatbotIndependente(text, history, model);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: res.resposta || "Sem resposta.",
        },
      ]);
    } catch (e: any) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: e?.message || "Falha na comunicação com o motor.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, model]);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 h-screen">
        <header className="h-14 border-b border-border/50 flex items-center justify-between px-4 sm:px-6 shrink-0 bg-card/60 backdrop-blur">
          <div className="flex items-center gap-3">
            <AnimatedIcon icon={Bot} variant="glow" size={22} className="text-primary" />
            <div>
              <h1 className="text-sm font-black uppercase tracking-tight">Consultor Neural</h1>
              <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest">
                Chat operacional
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={model}
              onChange={(e) => setModel(e.target.value as "xai" | "groq")}
              className="h-8 text-[10px] font-bold uppercase rounded-lg border border-border bg-secondary/40 px-2"
            >
              <option value="xai">xAI Grok</option>
              <option value="groq">Groq</option>
            </select>
            <AnimatedIcon icon={Sparkles} variant="shimmer" size={16} className="text-primary/70" />
          </div>
        </header>

        <div className="flex-1 flex flex-col lg:flex-row min-h-0">
          {/* Chat */}
          <div
            className={cn(
              "flex flex-col min-h-0",
              embedUrl && embedExpanded ? "lg:w-1/2" : "w-full"
            )}
          >
            <ScrollArea className="flex-1 p-4 sm:p-6">
              <div className="max-w-3xl mx-auto space-y-4">
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={cn(
                      "rounded-2xl px-4 py-3 text-sm leading-relaxed",
                      m.role === "user"
                        ? "bg-primary text-primary-foreground ml-8 sm:ml-16"
                        : "bg-secondary/60 mr-8 sm:mr-16 border border-border/40"
                    )}
                  >
                    {m.content}
                  </div>
                ))}
                {loading && (
                  <div className="flex items-center gap-2 text-muted-foreground text-xs font-bold uppercase tracking-widest">
                    <Loader2 className="animate-spin" size={14} />
                    Processando…
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            </ScrollArea>

            <div className="p-4 border-t border-border/50 bg-card/40">
              <form
                className="max-w-3xl mx-auto flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
              >
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Pergunta ou link…"
                  className="h-12 rounded-xl bg-secondary/30 border-none font-medium"
                  disabled={loading}
                />
                <Button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="h-12 w-12 rounded-xl shrink-0"
                >
                  {loading ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <AnimatedIcon icon={Send} variant="float" size={18} />
                  )}
                </Button>
              </form>
            </div>
          </div>

          {/* Painel embutido (easter egg — visual limpo, legível) */}
          {embedUrl && (
            <div
              className={cn(
                "flex flex-col border-l border-border/50 bg-background min-h-[40vh] lg:min-h-0",
                embedExpanded ? "lg:w-1/2" : "lg:w-12"
              )}
            >
              <div className="h-10 flex items-center justify-between px-2 border-b border-border/40 shrink-0">
                {embedExpanded && (
                  <span className="text-[10px] font-bold text-muted-foreground truncate px-2">
                    Visualização
                  </span>
                )}
                <div className="flex items-center gap-1 ml-auto">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => setEmbedExpanded((v) => !v)}
                    title={embedExpanded ? "Recolher" : "Expandir"}
                  >
                    {embedExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    asChild
                  >
                    <a href={embedUrl} target="_blank" rel="noopener noreferrer" title="Abrir">
                      <ExternalLink size={14} />
                    </a>
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => setEmbedUrl(null)}
                    title="Fechar"
                  >
                    <X size={14} />
                  </Button>
                </div>
              </div>
              {embedExpanded && (
                <iframe
                  src={embedUrl}
                  title="view"
                  className="flex-1 w-full border-0 bg-white min-h-[320px]"
                  // sandboxed o suficiente para legibilidade; allow scripts do site
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
