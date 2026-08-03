/**
 * Assistente interno — motores selecionáveis + consulta CNJ (DataJud/DJEN).
 */
"use client";

import React, { useState, useRef, useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User, Loader2, Copyright, Search } from "lucide-react";
import { perguntarChatbotIndependente } from "@/app/chatbot-separado/actions";
import { MotorSelector } from "@/components/ai/motor-selector";
import { loadPreferredMotor, MotorId, extractCnjFromText } from "@/lib/ai/motors";
import { DataJudDisclaimer } from "@/components/ui/datajud-disclaimer";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

export default function AssistentePage() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Assistente operacional Lexis. Envie um CNJ na pergunta para eu consultar DataJud + DJEN e responder com base nos andamentos reais. Escolha o motor no seletor (salva em Configurações).",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState<MotorId>("xai");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setModel(loadPreferredMotor());
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const cnj = extractCnjFromText(text);
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
          content:
            (res.resposta || "Sem resposta.") +
            (res.engineUtilizada ? `\n\n— motor: ${res.engineUtilizada}${cnj ? ` · CNJ ${cnj}` : ""}` : ""),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Falha ao contatar o motor. Verifique ENVs e o seletor de motor.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-transparent font-sans text-foreground overflow-hidden relative z-10">
      <Sidebar />
      <main className="flex-1 flex flex-col h-screen overflow-hidden glass-panel">
        <header className="shrink-0 border-b border-border px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Bot size={18} className="text-primary" />
            <div>
              <h1 className="text-sm font-black uppercase tracking-widest">Assistente IA</h1>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Search size={10} /> Inclua o CNJ na pergunta para puxar DataJud + DJEN
              </p>
            </div>
          </div>
          <MotorSelector value={model} onChange={setModel} />
        </header>

        <ScrollArea className="flex-1 px-4 sm:px-6 py-4">
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn("flex gap-2", m.role === "user" ? "justify-end" : "justify-start")}
              >
                {m.role === "assistant" && (
                  <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                    <Bot size={16} />
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
                <Loader2 className="animate-spin" size={14} /> Consultando motor
                {extractCnjFromText(messages[messages.length - 1]?.content || "")
                  ? " + DataJud/DJEN…"
                  : "…"}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        <form onSubmit={send} className="shrink-0 border-t border-border p-4 sm:px-6 bg-card/50">
          <div className="max-w-3xl mx-auto flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ex.: Resumo do 0001234-56.2024.8.26.0100 e o que falar ao cliente"
              className="h-12 rounded-xl"
              disabled={loading}
            />
            <Button type="submit" disabled={loading || !input.trim()} className="h-12 px-5 rounded-xl shrink-0">
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
