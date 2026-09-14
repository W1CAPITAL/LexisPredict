"use client";

import { useState } from "react";
import { usePlano } from "@/hooks/use-plano";
import { useAdmin } from "@/hooks/use-admin";
import { PLAN_IDS, PLAN_LABEL, PLAN_PACOTES, type PlanId } from "@/lib/planos-pacotes";
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
    const atuais = PLAN_PACOTES[plan];
    const destino = PLAN_PACOTES[id];
    if (atuais.every((pacote) => destino.includes(pacote))) return "upgrade";
    if (destino.every((pacote) => atuais.includes(pacote))) return "downgrade";
    return "troca";
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
    <section aria-label="Planos e assinatura" className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Planos e assinatura</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Plano atual:{" "}
            <span className="font-medium text-foreground">{PLAN_LABEL[plan]}</span>
            {" · "}
            {situacao}
            {expiresLabel ? ` · até ${expiresLabel}` : ""}
          </p>
        </div>
        <div role="group" aria-label="Período de cobrança" className="inline-flex rounded-lg border bg-muted p-1 text-sm">
          <button
            type="button"
            className={cn(
              "min-h-11 rounded-md px-4 py-2 font-medium",
              ciclo === "mensal" && "bg-foreground text-background"
            )}
            aria-pressed={ciclo === "mensal"}
            onClick={() => setCiclo("mensal")}
          >
            Mensal
          </button>
          <button
            type="button"
            className={cn(
              "min-h-11 rounded-md px-4 py-2 font-medium",
              ciclo === "anual" && "bg-foreground text-background"
            )}
            aria-pressed={ciclo === "anual"}
            onClick={() => setCiclo("anual")}
          >
            Anual
          </button>
        </div>
      </div>

      <div className="grid items-stretch gap-4 lg:grid-cols-2">
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
              data-plan={id}
              className={cn(
                "flex min-w-0 flex-col rounded-xl border bg-card p-5 sm:p-6",
                atual && "border-primary",
                !atual && "border-border"
              )}
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{PLAN_LABEL[id]}</h3>
                  <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{p.tagline}</p>
                </div>
                {atual ? (
                  <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-xs font-medium">
                    Plano atual
                  </span>
                ) : null}
              </div>
              <p aria-live="polite" className="text-3xl font-semibold tracking-tight tabular-nums">
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
              <ul className="mb-4 mt-5 space-y-2.5 text-sm leading-relaxed">
                {p.beneficios.map((b) => (
                  <li key={b} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              {p.naoInclui?.length ? (
                <p className="mb-5 text-xs leading-relaxed text-muted-foreground">
                  Não inclui: {p.naoInclui.join(" · ")}
                </p>
              ) : null}
              <button
                type="button"
                disabled={atual || !!busy || !canChange}
                onClick={() => void onEscolher(id)}
                className={cn(
                  "mt-auto min-h-11 w-full rounded-lg px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60",
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
                  tipo === "downgrade" ? `Mudar para ${PLAN_LABEL[id]}` : `Trocar para ${PLAN_LABEL[id]}`
                )}
              </button>
            </article>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Valores do catálogo do aplicativo. O anual mostra o total do período e o equivalente mensal.
        {canChange ? " Você pode alterar o plano da empresa." : " Peça ao administrador da empresa para alterar o plano."}
      </p>
    </section>
  );
}
