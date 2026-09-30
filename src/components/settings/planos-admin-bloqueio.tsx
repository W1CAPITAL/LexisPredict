"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useAdmin } from "@/hooks/use-admin";
import { checkIfSuperAdmin } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  listEmpresasParaPlanosAction,
  bloquearEmpresaPlanoAction,
  liberarEmpresaPlanoAction,
  type EmpresaPlanoRow,
} from "@/app/actions/planos-actions";
import {
  PLAN_IDS,
  PLAN_LABEL,
  type PlanId,
  normalizePlanId,
} from "@/lib/planos-pacotes";
import {
  addDaysIso,
  PLAN_DIAS_PADRAO,
  daysLeft,
  formatExpira,
} from "@/lib/planos-assinatura";
import {
  Ban,
  Building2,
  CheckCircle2,
  Database,
  Loader2,
  RefreshCw,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

type DraftMap = Record<string, { plan: PlanId; days: 30 | 365 }>;

function rowStatus(row: EmpresaPlanoRow) {
  const billing = String(row.billing_status || "").toLowerCase();
  const blocked = !!row.plano_bloqueado || ["past_due", "suspended", "canceled"].includes(billing);
  const exp = row.plano_expira_em ? new Date(row.plano_expira_em).getTime() : null;
  const expired = exp !== null && Number.isFinite(exp) && exp < Date.now();

  if (blocked) return { label: "Suspensa", tone: "danger" as const };
  if (expired) return { label: "Expirada", tone: "warning" as const };
  if (billing === "pending") return { label: "Pendente", tone: "pending" as const };
  return { label: "Ativa", tone: "success" as const };
}

export function PlanosAdminBloqueio() {
  const { profile } = useAdmin();
  const isSuperAdmin = checkIfSuperAdmin(profile);
  const { toast } = useToast();
  const [rows, setRows] = useState<EmpresaPlanoRow[]>([]);
  const [drafts, setDrafts] = useState<DraftMap>({});
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const list = await listEmpresasParaPlanosAction();
      setRows(list);
      setDrafts((prev) => {
        const next = { ...prev };
        for (const row of list) {
          if (!next[row.id]) {
            next[row.id] = {
              plan: normalizePlanId(row.plano || "essencial"),
              days: 30,
            };
          }
        }
        return next;
      });
    } catch (e: any) {
      toast({
        title: "Falha ao carregar empresas",
        description: e?.message || "Não foi possível consultar o Supabase.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) void reload();
  }, [isSuperAdmin]);

  const counters = useMemo(() => {
    let active = 0;
    let blocked = 0;
    let pending = 0;
    for (const row of rows) {
      const s = rowStatus(row).label;
      if (s === "Ativa") active++;
      else if (s === "Pendente") pending++;
      else blocked++;
    }
    return { total: rows.length, active, blocked, pending };
  }, [rows]);

  if (!isSuperAdmin) return null;

  const setDraft = (id: string, patch: Partial<DraftMap[string]>) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        plan: prev[id]?.plan || "essencial",
        days: prev[id]?.days || 30,
        ...patch,
      },
    }));
  };

  const bloquear = async (empresaId: string, nome: string) => {
    setBusyId(empresaId);
    try {
      const res = await bloquearEmpresaPlanoAction(empresaId, "inadimplencia");
      if (!res.ok) {
        toast({ title: "Não foi possível suspender", description: res.error, variant: "destructive" });
        return;
      }
      toast({ title: "Assinatura suspensa", description: nome });
      await reload();
    } finally {
      setBusyId(null);
    }
  };

  const liberar = async (row: EmpresaPlanoRow) => {
    const draft = drafts[row.id] || {
      plan: normalizePlanId(row.plano || "essencial"),
      days: 30 as const,
    };
    setBusyId(row.id);
    try {
      const expiresAt = addDaysIso(draft.days);
      const res = await liberarEmpresaPlanoAction(row.id, draft.plan, expiresAt);
      if (!res.ok) {
        toast({ title: "Não foi possível ativar", description: res.error, variant: "destructive" });
        return;
      }
      toast({
        title: "Assinatura ativada",
        description: row.nome + " · " + PLAN_LABEL[draft.plan] + " · " + draft.days + " dias",
      });
      await reload();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="overflow-hidden rounded-[24px] border bg-card shadow-sm">
      <div className="border-b bg-gradient-to-r from-primary/10 via-transparent to-violet-500/5 p-5 sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                Console comercial
              </p>
            </div>
            <h3 className="mt-2 text-lg font-black tracking-tight">
              Empresas e assinaturas
            </h3>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
              O status abaixo vem do Supabase. Cache local não decide bloqueio, vencimento ou plano.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => void reload()}
            disabled={loading}
            className="h-10 shrink-0 font-semibold"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Atualizar Supabase
          </Button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Empresas", counters.total],
            ["Ativas", counters.active],
            ["Pendentes", counters.pending],
            ["Restritas", counters.blocked],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-2xl border bg-background/70 px-4 py-3">
              <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-black tabular-nums">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 sm:p-6">
        {!rows.length && !loading ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/15 p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border bg-background shadow-sm">
              <Database className="h-6 w-6 text-muted-foreground" />
            </div>
            <h4 className="mt-4 text-base font-black">Nenhuma empresa cadastrada</h4>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              O Supabase está vazio e isso é um estado normal de instalação. Nenhuma empresa será tratada como bloqueada até existir uma linha real em <code className="rounded bg-muted px-1">empresas</code>.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => {
              const draft = drafts[row.id] || {
                plan: normalizePlanId(row.plano || "essencial"),
                days: 30 as const,
              };
              const status = rowStatus(row);
              const left = daysLeft(row.plano_expira_em);
              const busy = busyId === row.id;

              return (
                <article key={row.id} className="rounded-2xl border bg-background/40 p-4 sm:p-5">
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                          <Building2 className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black">{row.nome}</p>
                          <p className="mt-0.5 truncate font-mono text-[9px] text-muted-foreground">{row.id}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <Badge variant="outline" className="text-[9px] font-bold">
                              {PLAN_LABEL[normalizePlanId(row.plano || "essencial")]}
                            </Badge>
                            <Badge
                              className={cn(
                                "text-[9px] font-bold",
                                status.tone === "success" && "bg-emerald-600 text-white",
                                status.tone === "danger" && "bg-red-600 text-white",
                                status.tone === "warning" && "bg-amber-600 text-white",
                                status.tone === "pending" && "bg-sky-600 text-white"
                              )}
                            >
                              {status.label}
                            </Badge>
                            {left !== null ? (
                              <span className="text-[10px] text-muted-foreground">
                                {left > 0 ? left + " dias restantes" : "prazo encerrado"}
                              </span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">sem validade definida</span>
                            )}
                            {row.plano_expira_em ? (
                              <span className="text-[10px] text-muted-foreground">
                                · {formatExpira(row.plano_expira_em)}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-[minmax(150px,1fr)_120px_auto] xl:w-[560px]">
                      <select
                        value={draft.plan}
                        disabled={busy}
                        onChange={(e) => setDraft(row.id, { plan: normalizePlanId(e.target.value) })}
                        className="h-10 rounded-xl border bg-background px-3 text-sm font-semibold outline-none ring-offset-background focus:ring-2 focus:ring-ring"
                        aria-label="Plano"
                      >
                        {PLAN_IDS.map((id) => (
                          <option key={id} value={id}>{PLAN_LABEL[id]}</option>
                        ))}
                      </select>

                      <select
                        value={draft.days}
                        disabled={busy}
                        onChange={(e) => setDraft(row.id, { days: Number(e.target.value) === 365 ? 365 : 30 })}
                        className="h-10 rounded-xl border bg-background px-3 text-sm font-semibold outline-none ring-offset-background focus:ring-2 focus:ring-ring"
                        aria-label="Validade"
                      >
                        <option value={PLAN_DIAS_PADRAO.mensal}>30 dias</option>
                        <option value={PLAN_DIAS_PADRAO.anual}>365 dias</option>
                      </select>

                      <Button
                        className="h-10 bg-emerald-600 font-semibold text-white hover:bg-emerald-700"
                        disabled={busy}
                        onClick={() => void liberar(row)}
                      >
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                        Ativar
                      </Button>
                    </div>

                    <Button
                      variant="outline"
                      className="h-10 border-red-500/25 text-red-600 hover:bg-red-500/10 hover:text-red-700"
                      disabled={busy || status.label === "Suspensa"}
                      onClick={() => void bloquear(row.id, row.nome)}
                    >
                      <Ban className="mr-2 h-4 w-4" />
                      Suspender
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
