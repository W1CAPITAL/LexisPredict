"use client";

import React, { useState } from "react";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type Instruction = {
  id: string;
  title: string;
  description: string;
  content: string;
};

export const LEXIS_INSTRUCTIONS: Instruction[] = [
  {
    id: "conciso",
    title: "Seja conciso",
    description: "Respostas curtas para gabinete",
    content: "Responda de forma breve e operacional, em português do Brasil.",
  },
  {
    id: "cliente",
    title: "Tom para cliente",
    description: "Linguagem clara, sem juridiquês excessivo",
    content:
      "Quando pedir mensagem ao cliente, use tom profissional, claro e tranquilizador. Não invente prazos.",
  },
  {
    id: "raciocinio",
    title: "Mostre raciocínio",
    description: "Passos antes da conclusão",
    content:
      "Quando útil, explique o raciocínio em poucas linhas antes da resposta final.",
  },
  {
    id: "sem-ba-falso",
    title: "Não alarmar BA",
    description: "Só confirme busca e apreensão se mandado real",
    content:
      "Não trate menção genérica a busca e apreensão como mandado. Só confirme se o teor for claro.",
  },
];

export function AiInstructionsPanel({
  value,
  onChange,
  className,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  function toggle(id: string) {
    if (value.includes(id)) onChange(value.filter((x) => x !== id));
    else onChange([...value, id]);
  }

  return (
    <div className={cn("relative", className)}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-9 gap-1.5 font-black uppercase text-[9px]"
        onClick={() => setOpen((v) => !v)}
      >
        <Settings2 size={14} /> Instruções
        {value.length ? (
          <span className="ml-1 rounded-full bg-primary/15 text-primary px-1.5 text-[9px]">
            {value.length}
          </span>
        ) : null}
      </Button>
      {open ? (
        <div className="absolute bottom-full mb-2 right-0 z-50 w-72 rounded-2xl border-2 border-black bg-card shadow-[8px_8px_0_#000] p-2 space-y-1">
          {LEXIS_INSTRUCTIONS.map((i) => {
            const on = value.includes(i.id);
            return (
              <button
                key={i.id}
                type="button"
                onClick={() => toggle(i.id)}
                className={cn(
                  "w-full text-left rounded-lg px-2 py-2 text-sm transition-colors",
                  on ? "bg-primary/10 border border-primary/30" : "hover:bg-muted"
                )}
              >
                <p className="font-semibold">{i.title}</p>
                <p className="text-[11px] text-muted-foreground">{i.description}</p>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function buildInstructionsPrefix(ids: string[]): string {
  const parts = LEXIS_INSTRUCTIONS.filter((i) => ids.includes(i.id)).map(
    (i) => `- ${i.content}`
  );
  if (!parts.length) return "";
  return `Instruções ativas do usuário:\n${parts.join("\n")}\n\n`;
}
