"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Props = {
  text: string;
  className?: string;
  title?: string;
};

export function AiDraftPreview({
  text,
  className,
  title = "Rascunho gerado",
}: Props) {
  const { toast } = useToast();
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({ title: "Copiado!" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Falha ao copiar", variant: "destructive" });
    }
  };

  if (!text) return null;

  return (
    <div
      className={cn(
        "ai-draft-preview rounded-xl border border-slate-600 overflow-hidden bg-slate-950",
        className
      )}
    >
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-700">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          {title}
        </span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={handleCopy}
          className="h-7 gap-1.5 text-[10px] font-bold uppercase text-slate-200 hover:text-white"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copiado" : "Copiar"}
        </Button>
      </div>
      <div
        data-ai-draft
        className="p-4 ai-draft-body whitespace-pre-wrap text-sm leading-relaxed text-slate-50 bg-slate-950"
      >
        {text}
      </div>
    </div>
  );
}
