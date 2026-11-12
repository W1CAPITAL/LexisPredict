"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LegalCase } from "@/lib/case-logic";
import { sugerirAtividades } from "@/lib/atividades-sugeridas";
import {
 listLegalWorkflowStepsAction,
 setLegalWorkflowStepAction,
 type WorkflowStepState,
} from "@/app/actions/legal-workflow-actions";

/** Checklist compartilhado por empresa/processo. Sem estado local fictício. */
export function AtividadesChecklist({ caseData, className }: {
 caseData: LegalCase;
 className?: string;
}) {
 const base = useMemo(() => sugerirAtividades(caseData), [caseData]);
 const protocolo = String(caseData.protocolo || "").trim();
 const [steps, setSteps] = useState<WorkflowStepState[]>([]);
 const [loading, setLoading] = useState(true);
 const [busy, setBusy] = useState<string | null>(null);
 const [error, setError] = useState("");
 useEffect(() => {
  let active = true;
  setLoading(true);
  setSteps([]);
  setError("");
  if (!protocolo) {
   setError("Processo sem protocolo. Não é possível compartilhar as etapas.");
   setLoading(false);
   return;
  }
  listLegalWorkflowStepsAction({ protocolo }).then((result) => {
   if (!active) return;
   if (result.success) setSteps(result.steps);
   else setError(result.error);
  }).catch(() => { if (active) setError("Não foi possível carregar o checklist compartilhado."); })
    .finally(() => { if (active) setLoading(false); });
  return () => { active = false; };
 }, [protocolo]);
 async function toggle(tipo: string, title: string) {
  if (busy || error || loading) return;
  const current = steps.find((s) => s.step_key === tipo);
  setBusy(tipo);
  const result = await setLegalWorkflowStepAction({
   protocolo, step_key: tipo, title, done: current?.status !== "done",
  }).catch(() => ({ success: false as const, error: "Falha ao salvar etapa." }));
  if (result.success) setSteps(result.steps);
  else setError(result.error);
  setBusy(null);
 }
 if (!base.length) return null;
 return (
  <div className={cn("rounded-lg border border-border bg-background p-2.5 space-y-1.5 shadow-sm", className)}>
   <div className="flex items-center justify-between gap-2">
    <p className="text-[10px] font-semibold text-foreground tracking-wide">Próximos passos · compartilhado</p>
    {loading ? <Loader2 size={13} className="animate-spin" aria-label="Carregando" /> : null}
   </div>
   {error ? (
    <div role="alert" className="text-xs text-destructive">
     {error}
     <button className="ml-2 underline" onClick={async () => {
      setError(""); setLoading(true);
      const result = await listLegalWorkflowStepsAction({ protocolo }).catch(() => ({ success: false as const, error: "Falha na consulta" }));
      if (result.success) setSteps(result.steps); else setError(result.error);
      setLoading(false);
     }}>Tentar novamente</button>
    </div>
   ) : null}
   <ul className="space-y-1">
    {base.map((a) => {
     const record = steps.find((s) => s.step_key === a.tipo);
     const isDone = record?.status === "done";
     return (
      <li key={a.tipo}>
       <button type="button" disabled={loading || !!busy || !!error}
        onClick={() => toggle(a.tipo, a.label)}
        aria-pressed={isDone}
        className={cn("w-full flex items-start gap-2 text-left rounded-md px-1.5 py-1 text-[11px] transition-colors disabled:opacity-60",
         isDone ? "text-muted-foreground line-through bg-muted/40" : "text-foreground hover:bg-muted/50")}>
        <span className={cn("mt-0.5 h-4 w-4 rounded border flex items-center justify-center shrink-0",
         isDone ? "bg-emerald-600 border-emerald-600 text-white" : "border-border bg-background")}>
         {busy === a.tipo ? <Loader2 size={10} className="animate-spin" /> : isDone ? <Check size={10} strokeWidth={3} /> : null}
        </span>
        <span className="leading-snug">{a.label}</span>
       </button>
      </li>
     );
    })}
   </ul>
  </div>
 );
}
