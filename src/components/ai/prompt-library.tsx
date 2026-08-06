"use client";

import React, { useMemo, useState } from "react";
import { BookOpen, Search, Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type Prompt = {
  id: string;
  title: string;
  description: string;
  prompt: string;
  category: string;
  isCustom?: boolean;
};

export const LEXIS_PROMPTS: Prompt[] = [
  {
    id: "resumo-processo",
    title: "Resumir processo",
    description: "Resumo executivo do CNJ / movimentações",
    category: "Processo",
    prompt:
      "Resuma o processo abaixo de forma executiva para o gabinete: fase atual, últimos movimentos, riscos de prazo e próximo passo recomendado.\n\n",
  },
  {
    id: "explicar-djen",
    title: "Explicar publicação DJEN",
    description: "Linguagem clara para o cliente",
    category: "DJEN",
    prompt:
      "Explique esta publicação do diário oficial em linguagem clara para o cliente, sem alarmismo. Indique se há prazo, custas ou necessidade de documento.\n\n",
  },
  {
    id: "rascunho-whatsapp",
    title: "Rascunho WhatsApp",
    description: "Mensagem curta e profissional",
    category: "Atendimento",
    prompt:
      "Escreva uma mensagem curta de WhatsApp para o cliente sobre a novidade processual, tom profissional e tranquilizador, em português do Brasil.\n\n",
  },
  {
    id: "analise-sentenca",
    title: "Analisar sentença/PDF",
    description: "Mérito, recurso e riscos",
    category: "Decisão",
    prompt:
      "Analise o teor da decisão/sentença anexada: resultado (procedente/improcedente/parcial), fundamentos centrais, prazos recursais aparentes e orientações práticas ao gabinete.\n\n",
  },
  {
    id: "ba-check",
    title: "Checar busca e apreensão",
    description: "Só confirmar se mandado real",
    category: "Risco",
    prompt:
      "Avalie se o texto indica mandado real de busca e apreensão de bem ou apenas menção incidental. Seja rigoroso: não confirme BA por intimação genérica.\n\n",
  },
];

export function PromptLibraryPanel({
  onInsert,
  className,
}: {
  onInsert: (text: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [last, setLast] = useState<Prompt | null>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return LEXIS_PROMPTS;
    return LEXIS_PROMPTS.filter(
      (p) =>
        p.title.toLowerCase().includes(s) ||
        p.description.toLowerCase().includes(s) ||
        p.category.toLowerCase().includes(s)
    );
  }, [q]);

  const groups = useMemo(() => {
    const m = new Map<string, Prompt[]>();
    for (const p of filtered) {
      const arr = m.get(p.category) || [];
      arr.push(p);
      m.set(p.category, arr);
    }
    return Array.from(m.entries());
  }, [filtered]);

  return (
    <div className={cn("relative", className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 gap-1.5 font-black uppercase text-[9px]"
        onClick={() => setOpen((v) => !v)}
      >
        <BookOpen size={14} /> Prompts
      </Button>
      {open ? (
        <div className="absolute bottom-full mb-2 left-0 z-50 w-[min(100vw-2rem,360px)] rounded-2xl border-2 border-black bg-card shadow-[8px_8px_0_#000] overflow-hidden">
          <div className="p-2 border-b border-border flex items-center gap-2">
            <Search size={14} className="text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar prompt…"
              className="flex-1 bg-transparent text-sm outline-none"
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-2 space-y-3">
            {groups.map(([cat, items]) => (
              <div key={cat}>
                <p className="text-[9px] font-black uppercase text-muted-foreground px-1 mb-1">
                  {cat}
                </p>
                <div className="space-y-1">
                  {items.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="w-full text-left rounded-lg px-2 py-2 hover:bg-muted transition-colors"
                      onClick={() => {
                        onInsert(p.prompt);
                        setLast(p);
                        setOpen(false);
                      }}
                    >
                      <p className="text-sm font-semibold">{p.title}</p>
                      <p className="text-[11px] text-muted-foreground line-clamp-1">
                        {p.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {!filtered.length ? (
              <p className="text-xs text-muted-foreground p-2">Nenhum prompt.</p>
            ) : null}
          </div>
          {last ? (
            <div className="border-t border-border p-2 text-[10px] text-muted-foreground flex items-center gap-1">
              <Check size={12} className="text-emerald-500" /> Último: {last.title}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
