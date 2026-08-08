"use client";

/**
 * CRM Assessoria — Dashboard
 * Receita, a receber, atrasados, custo bancas, funil.
 */

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  crmDashboardAction,
  seedServicosPadraoAction,
} from "@/app/actions/crm-actions";
import type { CrmDashboard } from "@/lib/crm-types";
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Building2,
  Loader2,
  RefreshCcw,
  Package,
  Kanban,
  Wallet,
  Users,
  Upload,
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

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await crmDashboardAction();
      setCanViewFinance(res.canViewFinance);
      setData(res.data);
      if (!res.success && res.error) setError(res.error);
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
        {
          label: "Receita do mês",
          value: canViewFinance ? brl(data.receitaMes) : "—",
          icon: DollarSign,
          tone: "ok" as const,
        },
        {
          label: "A receber",
          value: canViewFinance ? brl(data.aReceber) : "—",
          icon: TrendingUp,
          tone: "info" as const,
        },
        {
          label: "Atrasados",
          value: canViewFinance ? brl(data.atrasados) : "—",
          icon: AlertTriangle,
          tone: data.atrasados > 0 ? ("danger" as const) : ("ok" as const),
        },
        {
          label: "Custo bancas (mês)",
          value: canViewFinance ? brl(data.custoTerceirosMes) : "—",
          icon: Building2,
          tone: "warn" as const,
        },
        {
          label: "Ticket médio",
          value: canViewFinance ? brl(data.ticketMedio) : "—",
          icon: Wallet,
          tone: "default" as const,
        },
        {
          label: "Conversão funil",
          value: `${data.conversaoPct}%`,
          icon: Kanban,
          tone: "info" as const,
        },
      ]
    : [];

  const toneCls = {
    default: "bg-card border-border",
    ok: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800/50",
    info: "bg-sky-50 border-sky-200 dark:bg-sky-950/40 dark:border-sky-800/50",
    warn: "bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800/50",
    danger: "bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:border-rose-800/50",
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-black tracking-tight">CRM Assessoria</h1>
              <p className="text-xs text-muted-foreground mt-1">
                Serviços · funil · recebíveis · fornecedores jurídicos (sem honorário de OAB interno)
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={load} disabled={loading}>
                {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <RefreshCcw className="h-4 w-4" />}
              </Button>
              <Button variant="outline" size="sm" onClick={seed}>
                Seed serviços
              </Button>
            </div>
          </header>

          {error && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800 p-4 text-sm text-foreground">
              <p className="font-bold">Configuração necessária</p>
              <p className="mt-1 text-muted-foreground">{error}</p>
              <p className="mt-2 text-xs">
                No Supabase SQL Editor, execute o arquivo <code className="font-mono">supabase/crm-assessoria.sql</code>
              </p>
            </div>
          )}

          {!canViewFinance && !loading && (
            <p className="text-xs text-muted-foreground rounded-lg border border-border bg-muted/40 px-3 py-2">
              Valores financeiros consolidados visíveis apenas para Administrador / Supervisor / Superadmin.
              Operadores usam Funil e cadastros operacionais.
            </p>
          )}

          <section className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {kpis.map((k) => (
              <div
                key={k.label}
                className={cn(
                  "rounded-2xl border p-4 min-h-[100px] flex flex-col justify-between",
                  toneCls[k.tone]
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    {k.label}
                  </span>
                  <k.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
                <p className="text-xl sm:text-2xl font-black tabular-nums text-foreground mt-2">
                  {loading ? "…" : k.value}
                </p>
              </div>
            ))}
          </section>

          {data && (
            <section className="flex flex-wrap gap-2">
              <Badge variant="outline">Negócios: {data.totalNegocios}</Badge>
              <Badge variant="outline">Leads: {data.leads}</Badge>
              <Badge variant="outline">Em execução: {data.emExecucao}</Badge>
              <Badge variant="outline">Concluídos: {data.concluidos}</Badge>
            </section>
          )}

          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { href: "/crm/servicos", label: "Serviços", desc: "Catálogo e preços", icon: Package },
              { href: "/crm/funil", label: "Funil", desc: "Lead → contrato → conclusão", icon: Kanban },
              { href: "/crm/financeiro", label: "Financeiro", desc: "Receber e pagar", icon: Wallet },
              { href: "/crm/fornecedores", label: "Fornecedores", desc: "Bancas terceiras", icon: Building2 },
              { href: "/clients", label: "Clientes", desc: "Carteira operacional", icon: Users },
              { href: "/crm/cobranca", label: "Régua cobrança", desc: "D-3 a crítico (grátis)", icon: AlertTriangle },
              { href: "/crm/conciliacao", label: "Conciliação CSV", desc: "Extrato banco grátis", icon: Upload },
              { href: "/crm/extrato", label: "Extrato & margem", desc: "Fluxo do mês e por serviço", icon: TrendingUp },
              { href: "/integracoes", label: "Integrações bancárias", desc: "Mapa PIX / Open Finance", icon: Building2 },
              { href: "/financas", label: "Finanças legada", desc: "Lançamentos avulsos", icon: DollarSign },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-2xl border border-border bg-card p-4 hover:border-primary/40 transition-colors"
              >
                <l.icon className="h-5 w-5 text-primary mb-2" />
                <p className="font-bold text-sm text-foreground">{l.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{l.desc}</p>
              </Link>
            ))}
          </section>
        </div>
      </main>
    </div>
  );
}
