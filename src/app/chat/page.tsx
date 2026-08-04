/**
 * Assistente IA — Claude completo + todos os motores + BA Claude/DJEN opcional.
 */
"use client";

import React, { useState, useRef, useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Send, Bot, User, Loader2, Copyright, Search, ShieldAlert, ImagePlus } from "lucide-react";
import { perguntarChatbotIndependente } from "@/app/chatbot-separado/actions";
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

type Msg = { role: "user" | "assistant"; content: string };

export default function AssistentePage() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Assistente Lexis (Claude + cascata). Envie um CNJ para consultar DataJud/DJEN. Anexe print se quiser análise visual (Claude vision). Ative BA+Claude se quiser confirmação de busca e apreensão no teor do diário.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState<MotorId>("claude");
  const [baClaude, setBaClaude] = useState(false);
  const [pendingImage, setPendingImage] = useState<{
    mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
    data: string;
  } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setModel(loadPreferredMotor());
    setBaClaude(loadBaClaudeDjenEnabled());
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const onFile = async (file: File | null) => {
    if (!file || !file.type.startsWith("image/")) return;
    const buf = await file.arrayBuffer();
    const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    const mediaType = (file.type as any) || "image/png";
    setPendingImage({ mediaType, data: b64 });
  };

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if ((!text && !pendingImage) || loading) return;

    const cnj = extractCnjFromText(text);
    const display = pendingImage
      ? `${text || "(imagem)"}\n[anexo: print]`
      : text;
    const next: Msg[] = [...messages, { role: "user", content: display }];
    setMessages(next);
    setInput("");
    const img = pendingImage;
    setPendingImage(null);
    setLoading(true);

    try {
      const history = next.slice(-10).map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      }));
      const res = await perguntarChatbotIndependente(text || "Analise a imagem.", history, model, {
        baClaudeDjen: baClaude,
        images: img ? [img] : undefined,
      });
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            (res.resposta || "Sem resposta.") +
            (res.engine || res.engineUtilizada
              ? `\n\n— motor: ${res.engine || res.engineUtilizada}${cnj ? ` · CNJ ${cnj}` : ""}${baClaude ? " · BA-Claude on" : ""}`
              : ""),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Falha ao contatar o motor. Verifique ENVs e Configurações → Núcleo Neural.",
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
                <Search size={10} /> Claude Messages API · CNJ · visão · BA opcional
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border px-3 py-1.5 bg-amber-500/5 border-amber-500/20">
              <ShieldAlert size={14} className="text-amber-600" />
              <Label htmlFor="chat-ba-claude" className="text-[10px] font-bold">
                BA+Claude/DJEN
              </Label>
              <Switch
                id="chat-ba-claude"
                checked={baClaude}
                onCheckedChange={(on) => {
                  setBaClaude(on);
                  saveBaClaudeDjenEnabled(on);
                }}
              />
            </div>
            <MotorSelector value={model} onChange={setModel} />
          </div>
        </header>

        <ScrollArea className="flex-1 px-4 sm:px-6 py-4">
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "flex gap-2",
                  m.role === "user" ? "justify-end" : "justify-start"
                )}
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
          {pendingImage && (
            <div className="max-w-3xl mx-auto mb-2 text-[10px] text-muted-foreground flex items-center gap-2">
              <ImagePlus size={12} /> Print anexado (Claude vision)
              <button
                type="button"
                className="underline"
                onClick={() => setPendingImage(null)}
              >
                remover
              </button>
            </div>
          )}
          <div className="max-w-3xl mx-auto flex gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0] || null)}
            />
            <Button
              type="button"
              variant="outline"
              className="h-12 w-12 rounded-xl shrink-0"
              onClick={() => fileRef.current?.click()}
              title="Anexar print (vision)"
            >
              <ImagePlus size={18} />
            </Button>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ex.: Resumo do 0001234-56.2024.8.26.0100 e o que falar ao cliente"
              className="h-12 rounded-xl"
              disabled={loading}
            />
            <Button
              type="submit"
              disabled={loading || (!input.trim() && !pendingImage)}
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
