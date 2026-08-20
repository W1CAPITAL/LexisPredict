"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAdmin } from "@/hooks/use-admin";
import {
  PLAN_IDS,
  PLAN_LABEL,
  PLAN_BLURB,
  PLAN_PACOTES,
  type PlanId,
} from "@/lib/planos-pacotes";
import { planoDaEmpresa, savePlanoEmpresa } from "@/lib/planos-store";
import {
  listEmpresasParaPlanosAction,
  salvarPlanoEmpresaAction,
} from "@/app/actions/planos-actions";

export function PlanosEmpresaPanel() {
  const { isSuperAdmin, profile } = useAdmin();
  const { toast } = useToast();
  const [empresas, setEmpresas] = useState<{ id: string; nome: string }[]>([]);
  const [empresaId, setEmpresaId] = useState(profile?.empresa_id || "");
  const [plan, setPlan] = useState<PlanId>("maximo");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      const rows = await listEmpresasParaPlanosAction().catch(() => []);
      if (!live) return;
      const list = rows.length
        ? rows
        : profile?.empresa_id
          ? [{ id: profile.empresa_id, nome: "Empresa atual" }]
          : [];
      setEmpresas(list);
      const id = list[0]?.id || profile?.empresa_id || "";
      setEmpresaId(id);
      setPlan(planoDaEmpresa(id, "maximo"));
    })();
    return () => {
      live = false;
    };
  }, [profile?.empresa_id]);

  if (!isSuperAdmin) return null;

  const onPickEmpresa = (id: string) => {
    setEmpresaId(id);
    setPlan(planoDaEmpresa(id, "maximo"));
  };

  const onSave = async () => {
    if (!empresaId) return;
    setLoading(true);
    try {
      savePlanoEmpresa(empresaId, plan);
      const res = await salvarPlanoEmpresaAction(empresaId, plan);
      toast({
        title: `Plano ${PLAN_LABEL[plan]}`,
        description: res.persisted
          ? "Gravado no banco e neste navegador."
          : "Gravado neste navegador. Rode a migration SQL para persistir em empresas.plano.",
      });
    } catch (e: any) {
      toast({ title: "Falha ao salvar plano", description: e?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-2xl border bg-card p-5 space-y-4">
      <div>
        <h2 className="text-sm font-black uppercase tracking-widest">Pacotes por empresa</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Máximo libera todos os pacotes. A empresa selecionada herda o plano marcado.
        </p>
      </div>

      <label className="block text-[10px] font-bold uppercase text-muted-foreground">
        Empresa
        <select
          className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-xs font-medium text-foreground"
          value={empresaId}
          onChange={(e) => onPickEmpresa(e.target.value)}
        >
          {empresas.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome}
            </option>
          ))}
        </select>
      </label>

      <div className="grid sm:grid-cols-2 gap-2">
        {PLAN_IDS.map((id) => {
          const on = plan === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setPlan(id)}
              className={`text-left rounded-xl border p-3 transition ${
                on ? "border-primary bg-primary/10" : "border-border hover:bg-muted/40"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black uppercase">{PLAN_LABEL[id]}</span>
                {id === "maximo" && (
                  <Badge className="text-[9px] uppercase">todos os pacotes</Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">{PLAN_BLURB[id]}</p>
              <p className="text-[10px] mt-1 text-muted-foreground">
                {PLAN_PACOTES[id].join(" + ")}
              </p>
            </button>
          );
        })}
      </div>

      <Button type="button" size="sm" onClick={onSave} disabled={loading || !empresaId}>
        {loading ? "Salvando…" : "Aplicar plano na empresa"}
      </Button>
    </section>
  );
}
