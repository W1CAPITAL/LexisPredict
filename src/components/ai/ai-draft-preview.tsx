/**
 * Prévia do rascunho IA — contraste legível (texto claro em fundo escuro).
 * Use em Processos e Tarefas no modal de Sugerir resposta / Gerar rascunho.
 */
"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type AiDraftPreviewProps = {
  text: string;
  editable?: boolean;
  onChange?: (value: string) => void;
  className?: string;
  placeholder?: string;
  minHeight?: string;
};

export function AiDraftPreview({
  text,
  editable = false,
  onChange,
  className,
  placeholder = "O rascunho da IA aparecerá aqui…",
  minHeight = "160px",
}: AiDraftPreviewProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!text?.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          Rascunho para o cliente
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-[10px] font-bold uppercase gap-1"
          onClick={copy}
          disabled={!text?.trim()}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copiado" : "Copiar"}
        </Button>
      </div>
      {editable ? (
        <textarea
          data-ai-draft
          className={cn(
            "ai-draft-preview w-full rounded-xl border border-slate-600",
            "bg-slate-950 text-slate-50 p-4 text-sm leading-relaxed",
            "placeholder:text-slate-400 resize-y focus:outline-none focus:ring-2 focus:ring-slate-500"
          )}
          style={{ minHeight }}
          value={text}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          spellCheck
        />
      ) : (
        <div
          data-ai-draft
          className={cn(
            "ai-draft-preview rounded-xl border border-slate-600",
            "bg-slate-950 text-slate-50 p-4 text-sm leading-relaxed whitespace-pre-wrap"
          )}
          style={{ minHeight }}
        >
          {text?.trim() ? text : <span className="text-slate-400">{placeholder}</span>}
        </div>
      )}
    </div>
  );
}
