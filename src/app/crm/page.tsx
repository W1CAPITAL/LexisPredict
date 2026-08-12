"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CrmShell } from "@/components/crm/crm-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { crmDashboardAction, seedServicosPadraoAction } from "@/app/actions/crm-actions";
import { crmObservedHintsAction } from "@/app/actions/crm-pipeline-actions";
import type { CrmDashboard } from "@/lib/crm-types";
import { CRM_FUNIL_LABELS } from "@/lib/crm-types";
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Loader2,
  RefreshCcw,
  Kanban,
  Wallet,
  Sparkles,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function CrmDashboardPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [canViewFinance, setCanViewFinance] = useState(false);
  const [data, setData] = useState<CrmDashboard | null>(null);
  const [error, setError] = useState("");
  const [hints, setHints] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [res, h] = await Promise.all([crmDashboardAction(), crmObservedHintsAction()]);
      setCanViewFinance(res.canViewFinance);
      setData(res.data);
      if (!res.success && res.error) setError(res.error);
      if (h.success) setHints(h.hints || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const seed = async () => {
    const res = await seedServicosPadraoAction();
    toast({
      title: res.success ? "Serviços padrão criados" : "Erro",
      description: res.success ? `${res.count} serviços` : res.error,
      variant: res.success ? "default" : "destructive",
    });
  };

  const kpis = data
    ? [
        { label: "Receita do mês", value: canViewFinance ? brl(data.receitaMes) : "—", icon: DollarSign, tone: "ok" as const },
        { label: "A receber", value: canViewFinance ? brl(data.aReceber) : "—", icon: TrendingUp, tone: "info" as const },
        {
          label: "Atrasados",
          value: canViewFinance ? brl(data.atrasados) : "—",
          icon: AlertTriangle,
          tone: data.atrasados > 0 ? ("danger" as const) : ("ok" as const),
        },
        {
          label: "Negócios abertos",
          value: String(data.negociosAbertos ?? 0),
          icon: Kanban,
          tone: "info" as const,
        },
      ]
    : [];

  return (
    <CrmShell
      title="CRM Assessoria"
      subtitle="Pipeline · financeiro · cobrança — multi-tenant"
      actions={
        <>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
          </Button>
          <Button variant="outline" size="sm" onClick={seed}>
            Seed serviços
          </Button>
          <Button size="sm" asChild>
            <Link href="/crm/funil">Abrir pipeline</Link>
          </Button>
        </>
      }
    >
      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm mb-4">
          {error}
          <p className="text-xs mt-1 text-muted-foreground">
            Se faltar tabela, rode o SQL em sql/crm_v2_migration.sql no Supabase.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {kpis.map((k) => (
          <div
            key={k.label}
            className={cn(
              "rounded-xl border border-border bg-card p-4",
              k.tone === "danger" && "border-red-500/50"
            )}
          >
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <k.icon className="h-4 w-4" />
              <span className="text-[10px] font-black uppercase">{k.label}</span>
            </div>
            <p className="text-xl font-black tabular-nums tracking-tight">{loading ? "…" : k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[10px] font-black uppercase text-muted-foreground mb-3">Funil (contagem)</p>
          <div className="flex flex-wrap gap-2">
            {data?.porStatus
              ? Object.entries(data.porStatus).map(([st, n]) => (
                  <Badge key={st} variant="secondary" className="text-[10px]">
                    {CRM_FUNIL_LABELS[st as keyof typeof CRM_FUNIL_LABELS] || st}: {n}
                  </Badge>
                ))
              : !loading && <span className="text-xs text-muted-foreground">Sem dados</span>}
          </div>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/crm/funil">
                <Kanban className="h-3.5 w-3.5 mr-1" /> Pipeline
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/crm/financeiro">
                <Wallet className="h-3.5 w-3.5 mr-1" /> Financeiro
              </Link>
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[10px] font-black uppercase text-muted-foreground mb-3 flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> Insights observados
          </p>
          <ul className="space-y-2">
            {hints.map((h, i) => (
              <li key={i} className="text-xs leading-relaxed border-l-2 border-primary/40 pl-2">
                {h}
              </li>
            ))}
            {!hints.length && !loading ? (
              <li className="text-xs text-muted-foreground">Nenhum alerta observado.</li>
            ) : null}
          </ul>
          <p className="text-[10px] text-muted-foreground mt-3">
            Regra Comp AI: nada sobre cliente é inventado — só contagens e status do banco.
          </p>
        </div>
      </div>
    </CrmShell>
  );
}
