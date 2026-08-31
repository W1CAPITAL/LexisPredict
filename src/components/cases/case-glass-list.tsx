"use client";

/**
 * Lista de processos em cards glass (alinha ao dock) — substitui planilha feia.
 */

import React from "react";
import { cn } from "@/lib/utils";
import type { LegalCase } from "@/lib/case-logic";
import { CaseBadges } from "@/components/cases/case-badges";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FileSearch,
  Pencil,
  Trash2,
  CalendarClock,
  Scale,
  Loader2,
  FileText,
  MessageSquare,
} from "lucide-react";

type Props = {
  items: LegalCase[];
  isOperador?: boolean;
  selectable?: boolean;
  selected?: Set<string>;
  onToggleSelect?: (protocolo: string, on: boolean) => void;
  onLogReturn?: (c: LegalCase) => void;
  onEdit?: (c: LegalCase) => void;
  onDelete?: (id: string) => void;
  onScan?: (c: LegalCase) => void;
  onSuggest?: (c: LegalCase) => void;
  onDossie?: (c: LegalCase) => void;
};

function prazoLabel(c: LegalCase) {
  const p = (c as any).proximo_retorno || (c as any).prazo || c.prazo;
  if (!p) return "Sem prazo";
  return String(p);
}

export function CaseGlassList({
  items,
  isOperador,
  selectable,
  selected,
  onToggleSelect,
  onLogReturn,
  onEdit,
  onDelete,
  onScan,
  onSuggest,
  onDossie,
}: Props) {
  const [busy, setBusy] = React.useState<string | null>(null);

  return (
    <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 p-1">
      {items.map((c) => {
        const proto = String(c.protocolo || c.id || "");
        const isSel = selected?.has(proto);
        return (
          <article
            key={c.id || proto}
            data-case-card
            className={cn(
              "lexis-case-card group relative rounded-2xl border border-white/15",
              "bg-background/55 backdrop-blur-xl shadow-lg",
              "p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:border-primary/30",
              isSel && "ring-2 ring-primary/40"
            )}
          >
            <div className="flex items-start gap-3">
              {selectable && (
                <div className="pt-1" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={!!isSel}
                    onCheckedChange={(v) => onToggleSelect?.(proto, !!v)}
                  />
                </div>
              )}
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-[13px] leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                    {c.cliente || "Sem cliente"}
                  </h3>
                  <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                    {proto.slice(0, 16)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  <CaseBadges c={c} showPriority className="gap-1" />
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1.5 rounded-xl bg-white/5 border border-white/10 px-2 py-1.5">
                    <Scale size={12} className="text-primary shrink-0" />
                    <span className="truncate">{c.tribunal || "—"}</span>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-xl bg-white/5 border border-white/10 px-2 py-1.5">
                    <CalendarClock size={12} className="text-amber-500 shrink-0" />
                    <span className="truncate font-semibold text-foreground/80">{prazoLabel(c)}</span>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-1">
                  {(c as any).advogado || (c as any).atendido_por || "—"}
                  {(c as any).ultimo_retorno || (c as any).retorno
                    ? ` · Retorno: ${(c as any).ultimo_retorno || (c as any).retorno}`
                    : ""}
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/10 pt-3">
              <IconBtn
                title="Scan"
                onClick={async () => {
                  if (!onScan) return;
                  setBusy(proto + "s");
                  await onScan(c);
                  setBusy(null);
                }}
              >
                {busy === proto + "s" ? <Loader2 size={14} className="animate-spin" /> : <FileSearch size={14} />}
              </IconBtn>
              <IconBtn title="Editar" onClick={() => onEdit?.(c)}>
                <Pencil size={14} />
              </IconBtn>
              <IconBtn title="Retorno" onClick={() => onLogReturn?.(c)}>
                <MessageSquare size={14} />
              </IconBtn>
              {onDossie && (
                <IconBtn title="Dossiê" onClick={() => onDossie(c)}>
                  <FileText size={14} />
                </IconBtn>
              )}
              {isOperador && onDelete && (
                <IconBtn title="Excluir" danger onClick={() => onDelete(String(c.id))}>
                  <Trash2 size={14} />
                </IconBtn>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  title,
  danger,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "h-9 w-9 rounded-xl flex items-center justify-center border border-white/10 bg-white/5",
        "hover:bg-primary/15 hover:text-primary transition-all duration-200",
        danger && "hover:bg-destructive/15 hover:text-destructive"
      )}
    >
      {children}
    </button>
  );
}
