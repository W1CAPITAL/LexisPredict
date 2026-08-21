"use client";

import React, { useEffect, useState } from "react";
import { useAdmin } from "@/hooks/use-admin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  listEmpresasParaPlanosAction,
  salvarPlanoEmpresaAction,
  bloquearEmpresaPlanoAction,
  liberarEmpresaPlanoAction,
} from "@/app/actions/planos-actions";
import {
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
} from "@/lib/planos-assinatura";
import { savePlanoEmpresa } from "@/lib/planos-store";
import { Ban, CheckCircle2, Loader2, Shield } from "lucide-react";

export function PlanosAdminBloqueio() {
  const { isSuperAdmin } = useAdmin();
  const { toast } = useToast();
  const [rows, setRows] = useState<{ id: string; nome: string; plano?: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  const reload = async () => {
    setLoading(true);
    try {
      const list = await listEmpresasParaPlanosAction().catch(() => []);
      setRows(list);
      setTick((t) => t + 1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) reload();
  }, [isSuperAdmin]);

  if (!isSuperAdmin) return null;

  const bloquear = async (empresaId: string, nome: string) => {
    const ass = getAssinatura(empresaId);
    saveAssinatura(empresaId, {
      ...ass,
      plan: normalizePlanId(ass.plan || "essencial"),
      blocked: true,
      blockedReason: "inadimplencia",
    });
    await bloquearEmpresaPlanoAction(empresaId, "inadimplencia").catch(() => {});
    toast({ title: "Empresa bloqueada", description: nome });
    setTick((t) => t + 1);
  };

  const liberar = async (empresaId: string, nome: string, plan: PlanId, dias: number) => {
    const expiresAt = addDaysIso(dias);
    savePlanoEmpresa(empresaId, plan, {
      expiresAt,
      blocked: false,
      blockedReason: "",
      origem: "superadmin",
    });
    await liberarEmpresaPlanoAction(empresaId, plan, expiresAt).catch(() => {});
    await salvarPlanoEmpresaAction(empresaId, plan).catch(() => {});
    toast({
      title: "Empresa liberada",
      description: `${nome} · ${PLAN_LABEL[plan]} até ${formatExpira(expiresAt)}`,
    });
    setTick((t) => t + 1);
  };

  return (
    <section className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
            <Shield size={16} className="text-primary" />
            Superadmin · bloqueio e liberação
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Bloqueie empresas que não pagaram. Liberação define plano + prazo. Contato:{" "}
            <strong className="text-foreground">{PROPRIETARIO_LABEL}</strong> · WhatsApp{" "}
            <span className="tabular-nums">{PROPRIETARIO_WHATSAPP}</span>
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={reload} disabled={loading} className="text-[10px] font-black uppercase">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Atualizar lista"}
        </Button>
      </div>

      <div className="space-y-2 max-h-[420px] overflow-y-auto">
        {rows.map((r) => {
          const ass = getAssinatura(r.id, {
            plan: normalizePlanId(r.plano || "maximo"),
            expiresAt: null,
            blocked: false,
          });
          const left = daysLeft(ass.expiresAt);
          return (
            <div
              key={r.id}
              className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-border/50 p-3 bg-muted/20"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{r.nome}</p>
                <div className="flex flex-wrap gap-1.5 mt-1 items-center">
                  <Badge variant="outline" className="text-[9px] font-black uppercase">
                    {PLAN_LABEL[normalizePlanId(ass.plan)]}
                  </Badge>
                  {ass.blocked ? (
                    <Badge className="bg-red-600 text-white text-[9px] font-black uppercase">Bloqueada</Badge>
                  ) : left !== null && left <= 0 ? (
                    <Badge className="bg-amber-600 text-white text-[9px] font-black uppercase">Expirada</Badge>
                  ) : left !== null ? (
                    <Badge variant="secondary" className="text-[9px] font-black uppercase">
                      {left} dia(s) restantes
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[9px] font-black uppercase">
                      Sem prazo fixo
                    </Badge>
                  )}
                  {ass.expiresAt && (
                    <span className="text-[10px] text-muted-foreground">até {formatExpira(ass.expiresAt)}</span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-8 text-[9px] font-black uppercase"
                  onClick={() => bloquear(r.id, r.nome)}
                >
                  <Ban className="h-3.5 w-3.5 mr-1" /> Bloquear
                </Button>
                <Button
                  size="sm"
                  className="h-8 text-[9px] font-black uppercase bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => liberar(r.id, r.nome, "maximo", PLAN_DIAS_PADRAO.mensal)}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Liberar 30d Máximo
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-[9px] font-black uppercase"
                  onClick={() => liberar(r.id, r.nome, "maximo", PLAN_DIAS_PADRAO.anual)}
                >
                  Liberar 365d
                </Button>
              </div>
            </div>
          );
        })}
        {!rows.length && (
          <p className="text-xs text-muted-foreground">Nenhuma empresa listada.</p>
        )}
      </div>
      <span className="sr-only">{tick}</span>
    </section>
  );
}
