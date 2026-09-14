"use client";

import { useState } from "react";
import { usePlano } from "@/hooks/use-plano";
import { useAdmin } from "@/hooks/use-admin";
import { PLAN_IDS, PLAN_LABEL, type PlanId } from "@/lib/planos-pacotes";
import {
  PLANOS_PRECOS,
  formatBRL,
  mensalDoAnual,
  economiaAnual,
} from "@/lib/planos-precos";
import { savePlanoEmpresa } from "@/lib/planos-store";
import { trocarMeuPlanoAction } from "@/app/actions/planos-actions";
import { useToast } from "@/hooks/use-toast";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function PlanosEmpresaPanel() {
  const { plan, isExpired, isBlocked, expiresLabel } = usePlano();
  const { profile, isAdmin, isSuperAdmin } = useAdmin();
  const { toast } = useToast();
  const [ciclo, setCiclo] = useState<"mensal" | "anual">("mensal");
  const [busy, setBusy] = useState<PlanId | null>(null);
  const canChange = !!(isAdmin || isSuperAdmin);

  const acao = (id: PlanId) => {
    if (id === plan) return "atual";
    const rank: Record<PlanId, number> = {
      essencial: 1,
      financeiro: 2,
      operacional: 3,
      maximo: 4,
    };
    return rank[id] > rank[plan] ? "upgrade" : "downgrade";
  };

  const onEscolher = async (id: PlanId) => {
    if (id === plan || busy) return;
    if (!canChange) {
      toast({
        title: "Sem permissão",
        description: "Só administrador da empresa troca o plano.",
      });
      return;
    }
    setBusy(id);
    try {
      const r = await trocarMeuPlanoAction(id, ciclo);
      if (!r.ok) {
        toast({
          title: "Não aplicou",
          description: r.error || "Falha ao gravar",
          variant: "destructive",
        });
        return;
      }
      const empresaId = String(profile?.empresa_id || "");
      if (empresaId) savePlanoEmpresa(empresaId, id);
      toast({
        title: acao(id) === "upgrade" ? "Upgrade aplicado" : "Plano alterado",
        description: `${PLAN_LABEL[id]} · ${ciclo}`,
      });
    } finally {
      setBusy(null);
    }
  };

  const situacao = isBlocked ? "Bloqueado" : isExpired ? "Vencido" : "Ativo";

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Planos</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Agora:{" "}
            <span className="font-medium text-foreground">{PLAN_LABEL[plan]}</span>
            {" · "}
            {situacao}
            {expiresLabel ? ` · até ${expiresLabel}` : ""}
          </p>
        </div>
        <div className="inline-flex rounded-lg border bg-card p-1 text-sm">
          <button
            type="button"
            className={cn(
              "rounded-md px-3 py-1.5",
              ciclo === "mensal" && "bg-primary text-primary-foreground"
            )}
            onClick={() => setCiclo("mensal")}
          >
            Mensal
          </button>
          <button
            type="button"
            className={cn(
              "rounded-md px-3 py-1.5",
              ciclo === "anual" && "bg-primary text-primary-foreground"
            )}
            onClick={() => setCiclo("anual")}
          >
            Anual
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {PLAN_IDS.map((id) => {
          const p = PLANOS_PRECOS[id];
          const atual = id === plan;
          const tipo = acao(id);
          const valor = ciclo === "mensal" ? p.valorMensal : p.valorAnual;
          const eq = ciclo === "anual" ? mensalDoAnual(id) : null;
          const eco = ciclo === "anual" ? economiaAnual(id) : 0;
          return (
            <article
              key={id}
              className={cn(
                "flex flex-col rounded-xl border bg-card p-4",
                atual && "border-primary",
                p.destaque && !atual && "border-primary/40"
              )}
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{PLAN_LABEL[id]}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">{p.tagline}</p>
                </div>
                {p.selo ? (
                  <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium">
                    {p.selo}
                  </span>
                ) : null}
              </div>
              <p className="text-2xl font-semibold tabular-nums">
                {formatBRL(valor)}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  /{ciclo === "mensal" ? "mês" : "ano"}
                </span>
              </p>
              {eq ? (
                <p className="text-xs text-muted-foreground">
                  {formatBRL(eq)}/mês no anual
                  {eco > 0 ? ` · economiza ${formatBRL(eco)}` : ""}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  12× no ano: {formatBRL(p.valorMensal * 12)}
                </p>
              )}
              <ul className="mt-3 space-y-1.5 text-sm">
                {p.beneficios.map((b) => (
                  <li key={b} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              {p.naoInclui?.length ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Não inclui: {p.naoInclui.join(" · ")}
                </p>
              ) : null}
              <button
                type="button"
                disabled={atual || !!busy}
                onClick={() => void onEscolher(id)}
                className={cn(
                  "mt-4 h-10 rounded-lg text-sm font-medium",
                  atual
                    ? "border bg-muted text-muted-foreground"
                    : "bg-foreground text-background hover:opacity-90"
                )}
              >
                {busy === id ? (
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                ) : atual ? (
                  "Plano atual"
                ) : tipo === "upgrade" ? (
                  `Upgrade · ${PLAN_LABEL[id]}`
                ) : (
                  `Downgrade · ${PLAN_LABEL[id]}`
                )}
              </button>
            </article>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Anual cobra 10 meses. Administrador ou supervisão aplica na empresa. Operador só consulta.
      </p>
    </section>
  );
}
