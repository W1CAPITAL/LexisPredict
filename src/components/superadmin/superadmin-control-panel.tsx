"use client";

/**
 * Painel completo Superadmin — assinaturas, bloqueio, prazos e liberação.
 * Só aparece para cargo Superadmin / role superadmin.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAdmin } from "@/hooks/use-admin";
import { checkIfSuperAdmin } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  listEmpresasParaPlanosAction,
  salvarPlanoEmpresaAction,
  bloquearEmpresaPlanoAction,
  liberarEmpresaPlanoAction,
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
  getAssinatura,
  saveAssinatura,
  PROPRIETARIO_WHATSAPP,
  PROPRIETARIO_LABEL,
  whatsappProprietarioUrl,
} from "@/lib/planos-assinatura";
import { savePlanoEmpresa } from "@/lib/planos-store";
import {
  Ban,
  CheckCircle2,
  Crown,
  Loader2,
  RefreshCcw,
  Search,
  Shield,
  Unlock,
  Clock,
  Building2,
  MessageCircle,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type EmpresaRow = {
  id: string;
  nome: string;
  plano?: string;
  plano_expira_em?: string | null;
  plano_bloqueado?: boolean;
};

type Filtro = "todas" | "ativas" | "expiradas" | "bloqueadas" | "sem_prazo";

export function SuperadminControlPanel() {
  const { profile } = useAdmin();
  const isSuperAdmin = checkIfSuperAdmin(profile);
  const { toast } = useToast();

  const [rows, setRows] = useState<EmpresaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [selected, setSelected] = useState<string | null>(null);
  const [planPick, setPlanPick] = useState<PlanId>("maximo");
  const [diasPick, setDiasPick] = useState<number>(30);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listEmpresasParaPlanosAction().catch(() => []);
      setRows(list as EmpresaRow[]);
      setTick((t) => t + 1);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSuperAdmin) reload();
  }, [isSuperAdmin, reload]);

  const enriched = useMemo(() => {
    return rows.map((r) => {
      const ass = getAssinatura(r.id, {
        plan: normalizePlanId(r.plano || "maximo"),
        expiresAt: r.plano_expira_em || null,
        blocked: !!r.plano_bloqueado,
      });
      // Prefer local assinatura (mais recente no browser)
      const local = getAssinatura(r.id);
      const merged = {
        plan: normalizePlanId(local.plan || ass.plan),
        expiresAt: local.expiresAt ?? ass.expiresAt,
        blocked: local.blocked || ass.blocked,
      };
      const left = daysLeft(merged.expiresAt);
      const expired = left !== null && left <= 0;
      return { ...r, ass: merged, left, expired };
    });
  }, [rows, tick]);

  const filtered = useMemo(() => {
    let list = enriched;
    const term = q.trim().toLowerCase();
    if (term) {
      list = list.filter(
        (r) =>
          r.nome.toLowerCase().includes(term) ||
          r.id.toLowerCase().includes(term)
      );
    }
    if (filtro === "bloqueadas") list = list.filter((r) => r.ass.blocked);
    if (filtro === "expiradas") list = list.filter((r) => r.expired && !r.ass.blocked);
    if (filtro === "ativas")
      list = list.filter((r) => !r.ass.blocked && !r.expired);
    if (filtro === "sem_prazo") list = list.filter((r) => r.left === null && !r.ass.blocked);
    return list;
  }, [enriched, q, filtro]);

  const stats = useMemo(() => {
    const total = enriched.length;
    const bloqueadas = enriched.filter((r) => r.ass.blocked).length;
    const expiradas = enriched.filter((r) => r.expired && !r.ass.blocked).length;
    const ativas = enriched.filter((r) => !r.ass.blocked && !r.expired).length;
    return { total, bloqueadas, expiradas, ativas };
  }, [enriched]);

  if (!isSuperAdmin) {
    return (
      <div className="rounded-2xl border border-border p-8 text-center space-y-2">
        <Shield className="mx-auto text-muted-foreground" size={28} />
        <h2 className="text-sm font-black uppercase tracking-widest">Acesso restrito</h2>
        <p className="text-sm text-muted-foreground">
          Este painel é exclusivo do Superadmin. Administradores e outros cargos não liberam nem bloqueiam planos.
        </p>
      </div>
    );
  }

  const run = async (id: string, fn: () => Promise<void>) => {
    setBusyId(id);
    try {
      await fn();
      setTick((t) => t + 1);
    } finally {
      setBusyId(null);
    }
  };

  const bloquear = (r: (typeof enriched)[0]) =>
    run(r.id, async () => {
      const prev = getAssinatura(r.id);
      saveAssinatura(r.id, {
        ...prev,
        plan: normalizePlanId(prev.plan || r.ass.plan),
        blocked: true,
        blockedReason: "inadimplencia",
      });
      await bloquearEmpresaPlanoAction(r.id, "inadimplencia").catch(() => {});
      toast({ title: "Empresa bloqueada", description: r.nome });
    });

  const liberar = (r: (typeof enriched)[0], plan: PlanId, dias: number) =>
    run(r.id, async () => {
      const expiresAt = addDaysIso(dias);
      savePlanoEmpresa(r.id, plan, {
        expiresAt,
        blocked: false,
        blockedReason: "",
        origem: "superadmin_painel",
      });
      await liberarEmpresaPlanoAction(r.id, plan, expiresAt).catch(() => {});
      await salvarPlanoEmpresaAction(r.id, plan).catch(() => {});
      toast({
        title: "Liberado",
        description: `${r.nome} · ${PLAN_LABEL[plan]} · ${dias} dia(s) · até ${formatExpira(expiresAt)}`,
      });
    });

  const aplicarSemPix = (r: (typeof enriched)[0], plan: PlanId) =>
    run(r.id, async () => {
      const expiresAt = addDaysIso(diasPick);
      savePlanoEmpresa(r.id, plan, {
        expiresAt,
        blocked: false,
        origem: "superadmin_sem_pix",
      });
      await salvarPlanoEmpresaAction(r.id, plan).catch(() => {});
      await liberarEmpresaPlanoAction(r.id, plan, expiresAt).catch(() => {});
      toast({
        title: "Aplicado sem Pix (Superadmin)",
        description: `${r.nome} · ${PLAN_LABEL[plan]} · ${diasPick}d`,
      });
    });

  const sel = enriched.find((r) => r.id === selected) || null;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-3xl border border-border/60 bg-gradient-to-br from-card via-card to-primary/5 p-5 sm:p-7 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-black text-white px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em]">
              <Crown size={12} className="text-primary" />
              Superadmin · Controle comercial
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">
              Liberar, bloquear e prazos
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Central exclusiva para gerir assinaturas das empresas. Só o Superadmin opera aqui.
              Clientes inadimplentes bloqueiam o app até liberação com prazo.
            </p>
            <p className="text-xs text-muted-foreground">
              Proprietário: <strong className="text-foreground">{PROPRIETARIO_LABEL}</strong>
              {" · "}WhatsApp <span className="tabular-nums font-bold text-foreground">{PROPRIETARIO_WHATSAPP}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={reload} disabled={loading} className="font-black uppercase text-[10px]">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RefreshCcw className="h-3.5 w-3.5 mr-1" />}
              Atualizar
            </Button>
            <Button asChild size="sm" className="font-black uppercase text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white">
              <a href={whatsappProprietarioUrl()} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-3.5 w-3.5 mr-1" /> WhatsApp proprietário
              </a>
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Empresas", value: stats.total, icon: Building2 },
            { label: "Ativas", value: stats.ativas, icon: CheckCircle2 },
            { label: "Expiradas", value: stats.expiradas, icon: Clock },
            { label: "Bloqueadas", value: stats.bloqueadas, icon: Ban },
          ].map((k) => (
            <div key={k.label} className="rounded-2xl border border-border/50 bg-background/80 p-3">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <k.icon size={14} />
                <span className="text-[9px] font-black uppercase tracking-widest">{k.label}</span>
              </div>
              <p className="text-2xl font-black tabular-nums">{k.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Filtros + defaults */}
      <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9 h-10"
              placeholder="Buscar empresa por nome ou id…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["todas", "Todas"],
                ["ativas", "Ativas"],
                ["expiradas", "Expiradas"],
                ["bloqueadas", "Bloqueadas"],
                ["sem_prazo", "Sem prazo"],
              ] as const
            ).map(([id, label]) => (
              <Button
                key={id}
                type="button"
                size="sm"
                variant={filtro === id ? "default" : "outline"}
                className="h-8 text-[9px] font-black uppercase"
                onClick={() => setFiltro(id)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-dashed border-border/60 p-3 bg-muted/20">
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Plano padrão</p>
            <select
              className="h-9 rounded-lg border border-border bg-background px-2 text-xs font-bold"
              value={planPick}
              onChange={(e) => setPlanPick(e.target.value as PlanId)}
            >
              {PLAN_IDS.map((id) => (
                <option key={id} value={id}>{PLAN_LABEL[id]}</option>
              ))}
            </select>
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Dias de acesso</p>
            <div className="flex gap-1">
              {[7, 15, 30, 90, 365].map((d) => (
                <Button
                  key={d}
                  type="button"
                  size="sm"
                  variant={diasPick === d ? "default" : "outline"}
                  className="h-9 text-[10px] font-black tabular-nums"
                  onClick={() => setDiasPick(d)}
                >
                  {d}d
                </Button>
              ))}
              <Input
                type="number"
                min={1}
                max={1095}
                className="h-9 w-20 text-xs"
                value={diasPick}
                onChange={(e) => setDiasPick(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground max-w-xs">
            Os botões de liberar na lista usam este plano e este prazo. Atalhos: 30d e 365d também disponíveis por linha.
          </p>
        </div>
      </div>

      {/* Lista */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
          <h2 className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
            <Shield size={14} /> Empresas ({filtered.length})
          </h2>
        </div>
        <div className="divide-y divide-border/40 max-h-[560px] overflow-y-auto">
          {filtered.map((r) => {
            const busy = busyId === r.id;
            return (
              <div
                key={r.id}
                className={cn(
                  "p-4 flex flex-col xl:flex-row xl:items-center gap-3 hover:bg-muted/20 transition-colors",
                  selected === r.id && "bg-primary/5"
                )}
              >
                <button
                  type="button"
                  className="flex-1 text-left min-w-0"
                  onClick={() => setSelected(r.id === selected ? null : r.id)}
                >
                  <p className="text-sm font-bold truncate">{r.nome}</p>
                  <p className="text-[10px] text-muted-foreground font-mono truncate">{r.id}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <Badge variant="outline" className="text-[9px] font-black uppercase">
                      {PLAN_LABEL[r.ass.plan]}
                    </Badge>
                    {r.ass.blocked && (
                      <Badge className="bg-red-600 text-white text-[9px] font-black uppercase">Bloqueada</Badge>
                    )}
                    {!r.ass.blocked && r.expired && (
                      <Badge className="bg-amber-600 text-white text-[9px] font-black uppercase">Expirada</Badge>
                    )}
                    {!r.ass.blocked && !r.expired && r.left !== null && (
                      <Badge variant="secondary" className="text-[9px] font-black uppercase">
                        {r.left}d restantes
                      </Badge>
                    )}
                    {r.left === null && !r.ass.blocked && (
                      <Badge variant="secondary" className="text-[9px] font-black uppercase">Sem prazo</Badge>
                    )}
                    {r.ass.expiresAt && (
                      <span className="text-[10px] text-muted-foreground">até {formatExpira(r.ass.expiresAt)}</span>
                    )}
                  </div>
                </button>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-8 text-[9px] font-black uppercase"
                    disabled={busy}
                    onClick={() => bloquear(r)}
                  >
                    {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Ban className="h-3.5 w-3.5 mr-1" />}
                    Bloquear
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 text-[9px] font-black uppercase bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={busy}
                    onClick={() => liberar(r, planPick, diasPick)}
                  >
                    <Unlock className="h-3.5 w-3.5 mr-1" />
                    Liberar {diasPick}d · {PLAN_LABEL[planPick]}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-[9px] font-black uppercase"
                    disabled={busy}
                    onClick={() => liberar(r, "maximo", PLAN_DIAS_PADRAO.mensal)}
                  >
                    30d Máximo
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-[9px] font-black uppercase"
                    disabled={busy}
                    onClick={() => liberar(r, "maximo", PLAN_DIAS_PADRAO.anual)}
                  >
                    365d Máximo
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8 text-[9px] font-black uppercase"
                    disabled={busy}
                    onClick={() => aplicarSemPix(r, planPick)}
                    title="Cortesia: aplica plano + prazo sem exigir Pix"
                  >
                    Sem Pix
                  </Button>
                </div>
              </div>
            );
          })}
          {!filtered.length && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma empresa neste filtro.
            </div>
          )}
        </div>
      </div>

      {/* Detalhe selecionado */}
      {sel && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="text-primary shrink-0 mt-0.5" size={18} />
            <div>
              <h3 className="text-sm font-black uppercase tracking-wide">{sel.nome}</h3>
              <p className="text-xs text-muted-foreground font-mono">{sel.id}</p>
              <p className="text-sm mt-2">
                Plano <strong>{PLAN_LABEL[sel.ass.plan]}</strong>
                {sel.ass.blocked && " · bloqueada"}
                {sel.expired && " · expirada"}
                {sel.left !== null && !sel.expired && ` · ${sel.left} dia(s) restantes`}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Use os botões da linha para bloquear ou liberar com o prazo escolhido acima.
              </p>
            </div>
          </div>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground text-center">
        Aplicar sem Pix e liberação com prazo são ações exclusivas do Superadmin. Administrador não vê este painel.
      </p>
    </div>
  );
}
