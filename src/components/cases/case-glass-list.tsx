"use client";

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
  History,
} from "lucide-react";
import { getOperacaoSistemaLabel } from "@/lib/operacao-sistema";

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

function formatCnjFull(raw: string): string {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length === 20) {
    return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16, 20)}`;
  }
  return String(raw || "").trim();
}

function isIsoDateLike(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}(T|\s|$)/.test(s) || /^\d{4}-\d{2}-\d{2}T\d{2}:/.test(s);
}

function formatDataCurta(s: string): string {
  const m = String(s || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return s;
}

function pickPrazo(c: LegalCase): string {
  const x = c as any;
  const p = x.proximoPrazo || x.proximo_retorno || x.proximoRetorno || x.prazo || "";
  const s = String(p || "").trim();
  if (!s || /^(#value!|n\/a|null|undefined|encerrado)$/i.test(s)) return "";
  return s;
}

function pickUltimoRetorno(c: LegalCase): string {
  const x = c as any;
  return String(x.ultimoRetorno || x.ultimo_retorno || x.retorno || "").trim();
}

/** Nome do ato + data separada — nunca mostrar ISO sozinho como "Tribunal". */
function pickUltimoMovimento(c: LegalCase): { texto: string; data: string } {
  const x = c as any;
  const candidatos = [
    x.datajud_ultimo_nome,
    x.evento_resumo,
    x.djen_ultimo_resumo,
    x.djen_resumo,
    x.andamento,
    x.ultimo_movimento,
  ];
  let texto = "";
  for (const cnd of candidatos) {
    const s = String(cnd || "").replace(/\s+/g, " ").trim();
    if (!s || isIsoDateLike(s)) continue;
    texto = s.slice(0, 180);
    break;
  }
  const dataRaw = String(
    x.datajud_ultimo_movimento || x.djen_ultima_data || x.evento_data || ""
  ).trim();
  const data = isIsoDateLike(dataRaw) ? formatDataCurta(dataRaw) : (dataRaw && !isIsoDateLike(dataRaw) ? dataRaw.slice(0, 16) : "");
  return { texto, data };
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
  onDossie,
}: Props) {
  const [busy, setBusy] = React.useState<string | null>(null);

  return (
    <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 p-1">
      {items.map((c) => {
        const protoRaw = String(c.protocolo || (c as any).protocolo_ref || c.id || "");
        const proto = formatCnjFull(protoRaw);
        const isSel = selected?.has(String(c.protocolo || protoRaw));
        const prazo = pickPrazo(c);
        const retorno = pickUltimoRetorno(c);
        const mov = pickUltimoMovimento(c);
        const sistemaLabel = getOperacaoSistemaLabel(c);

        return (
          <article
            key={c.id || protoRaw}
            data-case-card
            className={cn(
              "lexis-case-card group relative rounded-2xl border border-white/15",
              "bg-background/55 backdrop-blur-xl shadow-lg p-4",
              "transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:border-primary/30",
              isSel && "ring-2 ring-primary/40"
            )}
          >
            <div className="flex items-start gap-3">
              {selectable && (
                <div className="pt-1" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={!!isSel}
                    onCheckedChange={(v) =>
                      onToggleSelect?.(String(c.protocolo || protoRaw), !!v)
                    }
                  />
                </div>
              )}
              <div className="min-w-0 flex-1 space-y-2">
                <h3 className="font-bold text-[13px] leading-snug line-clamp-2 group-hover:text-primary">
                  {c.cliente || "Sem cliente"}
                </h3>
                <p className="text-[11px] font-mono font-semibold text-foreground/90 break-all" title={proto}>
                  {proto || "—"}
                </p>
                <div className="flex flex-wrap gap-1 items-center">
                  <CaseBadges c={c} showPriority className="gap-1" />
                  {sistemaLabel ? (
                    <span className="text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-slate-500/15 text-slate-600 dark:text-slate-300 border border-slate-500/20">
                      {sistemaLabel}
                    </span>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1.5 rounded-xl bg-white/5 border border-white/10 px-2 py-1.5 min-w-0">
                    <Scale size={12} className="text-primary shrink-0" />
                    <span className="truncate">{c.tribunal || "—"}</span>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-xl bg-white/5 border border-white/10 px-2 py-1.5 min-w-0">
                    <CalendarClock size={12} className={cn("shrink-0", prazo ? "text-amber-500" : "")} />
                    <span className={cn("truncate font-semibold", prazo && "text-foreground/90")}>
                      {prazo || "Sem prazo"}
                    </span>
                  </div>
                </div>
                {retorno ? <p className="text-[11px] text-muted-foreground">Retorno: {retorno}</p> : null}
                {mov.texto || mov.data ? (
                  <p className="text-[10px] text-foreground/80 leading-snug flex gap-1" title={mov.texto || mov.data}>
                    <History size={12} className="mt-0.5 shrink-0 text-sky-500" />
                    <span>
                      <span className="font-bold text-sky-600 dark:text-sky-400">Tribunal: </span>
                      {mov.texto || "Movimentação"}
                      {mov.data ? ` · ${mov.data}` : ""}
                    </span>
                  </p>
                ) : (
                  <p className="text-[10px] text-muted-foreground/70">Sem movimentação tribunal em cache — rode o Scan</p>
                )}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/10 pt-3">
              <IconBtn title="Scan" onClick={async () => {
                if (!onScan) return;
                setBusy(protoRaw + "s");
                await onScan(c);
                setBusy(null);
              }}>
                {busy === protoRaw + "s" ? <Loader2 size={14} className="animate-spin" /> : <FileSearch size={14} />}
              </IconBtn>
              <IconBtn title="Editar" onClick={() => onEdit?.(c)}><Pencil size={14} /></IconBtn>
              <IconBtn title="Registrar atendimento" onClick={() => onLogReturn?.(c)}><MessageSquare size={14} /></IconBtn>
              {onDossie && <IconBtn title="Dossiê" onClick={() => onDossie(c)}><FileText size={14} /></IconBtn>}
              {isOperador && onDelete && (
                <IconBtn title="Excluir" danger onClick={() => onDelete(String(c.id))}><Trash2 size={14} /></IconBtn>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function IconBtn({ children, onClick, title, danger }: {
  children: React.ReactNode; onClick?: () => void; title?: string; danger?: boolean;
}) {
  return (
    <button type="button" title={title} onClick={onClick} className={cn(
      "h-9 w-9 rounded-xl flex items-center justify-center border border-white/10 bg-white/5",
      "hover:bg-primary/15 hover:text-primary transition-all",
      danger && "hover:bg-destructive/15 hover:text-destructive"
    )}>{children}</button>
  );
}
