"use client";

/**
 * Botão conectado a tribunais-links — abre consulta pública (eproc preferencial).
 * Usar em: Cases, Tarefas, Veredito, Scanner, Automação Judicial.
 */

import React from "react";
import { ExternalLink, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getTribunalByCnj,
  getConsultaUrlForCnj,
  getFallbacksForCnj,
} from "@/lib/tribunais-links";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ConsultaTribunalButton({
  protocolo,
  className,
  size = "sm",
  label = "Consulta tribunal",
}: {
  protocolo?: string | null;
  className?: string;
  size?: "sm" | "icon" | "default";
  label?: string;
}) {
  const cnj = protocolo || "";
  const tribunal = getTribunalByCnj(cnj);
  const url = getConsultaUrlForCnj(cnj);
  const fallbacks = getFallbacksForCnj(cnj);

  if (!cnj || !url) {
    return null;
  }

  const open = (href: string) => {
    window.open(href, "_blank", "noopener,noreferrer");
  };

  if (!fallbacks.length) {
    return (
      <Button
        type="button"
        variant="outline"
        size={size === "icon" ? "icon" : "sm"}
        className={cn(
          "rounded-xl font-black uppercase text-[9px] tracking-widest gap-1.5",
          className
        )}
        onClick={() => open(url)}
        title={tribunal ? `${tribunal.sigla} · ${tribunal.sistema}` : "Consulta"}
      >
        <Scale size={14} />
        {size !== "icon" && label}
        <ExternalLink size={12} className="opacity-50" />
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size={size === "icon" ? "icon" : "sm"}
          className={cn(
            "rounded-xl font-black uppercase text-[9px] tracking-widest gap-1.5",
            className
          )}
        >
          <Scale size={14} />
          {size !== "icon" && (tribunal?.sigla || label)}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[200px]">
        <DropdownMenuItem
          className="text-[10px] font-bold uppercase cursor-pointer"
          onClick={() => open(url)}
        >
          Principal ({tribunal?.sistema})
        </DropdownMenuItem>
        {fallbacks.map((f, i) => (
          <DropdownMenuItem
            key={i}
            className="text-[10px] font-bold uppercase cursor-pointer"
            onClick={() => open(f.url)}
          >
            {f.label || f.sistema}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
