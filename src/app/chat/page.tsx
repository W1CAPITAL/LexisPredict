/**
 * Assistente interno — chat operacional (restaurado).
 * Usa motores configurados (xAI / Groq). Não substitui análise dos autos.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */
"use client";

import React, { useState, useRef, useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Send,
  Bot,
  User,
  Loader2,
  Copyright,
  Sparkles,
} from "lucide-react";
import { perguntarChatbotIndependente } from "@/app/chatbot-separado/actions";
import { DataJudDisclaimer } from "@/components/ui/datajud-disclaimer";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

export default function AssistentePage() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Sou o assistente operacional do LexisPredict. Posso ajudar com dúvidas de rotina, priorização de fila e redação. Não invento andamentos de processo — use a consulta por CNJ e a carteira para fatos do tribunal.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState<"xai" | "groq">("xai");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const history = next.slice(-10).map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      }));
      const res = await perguntarChatbotIndependente(text, history, model);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.resposta || "Sem resposta do motor.",
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Falha ao contatar o motor de IA. Verifique as chaves em Configurações.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <header className="shrink-0 border-b border-border px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
              <Sparkles size={18} className="text-primary shrink-0" />
              Assistente
            </h1>
            <p className="text-[11px] text-muted-foreground font-medium">
              Apoio à operação · validação humana obrigatória
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={model === "xai" ? "default" : "outline"}
              size="sm"
              className="text-[10px] font-bold uppercase"
              onClick={() => setModel("xai")}
            >
              xAI
            </Button>
            <Button
              type="button"
              variant={model === "groq" ? "default" : "outline"}
              size="sm"
              className="text-[10px] font-bold uppercase"
              onClick={() => setModel("groq")}
            >
              Groq
            </Button>
          </div>
        </header>

        <div className="px-4 sm:px-6 pt-3">
          <DataJudDisclaimer compact />
        </div>

        <ScrollArea className="flex-1 min-h-0 px-4 sm:px-6 py-4">
          <div className="max-w-3xl mx-auto space-y-4 pb-8">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "flex gap-3 animate-in fade-in duration-200",
                  m.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {m.role === "assistant" && (
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot size={16} className="text-primary" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap break-words",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/80 border border-border"
                  )}
                >
                  {m.content}
                </div>
                {m.role === "user" && (
                  <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                    <User size={16} />
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <Loader2 className="animate-spin" size={14} /> Gerando…
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        <form
          onSubmit={send}
          className="shrink-0 border-t border-border p-4 sm:px-6 bg-card/50"
        >
          <div className="max-w-3xl mx-auto flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte sobre fila, prazos, redação…"
              className="h-12 rounded-xl"
              disabled={loading}
            />
            <Button
              type="submit"
              disabled={loading || !input.trim()}
              className="h-12 px-5 rounded-xl shrink-0"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
            </Button>
          </div>
          <p className="max-w-3xl mx-auto mt-2 text-[10px] text-muted-foreground flex items-center gap-1">
            <Copyright size={10} /> Conteúdo de apoio — revise antes de enviar ao cliente.
          </p>
        </form>
      </main>
    </div>
  );
}
