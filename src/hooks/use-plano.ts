"use client";

import { useEffect, useMemo, useState } from "react";
import { useAdmin } from "@/hooks/use-admin";
import { hrefLiberado, type PlanId } from "@/lib/planos-pacotes";
import { planoDaEmpresa, subscribeEmpresaPlanos } from "@/lib/planos-store";

export function usePlano() {
  const { profile, isSuperAdmin } = useAdmin();
  const empresaId = profile?.empresa_id || "";
  const [plan, setPlan] = useState<PlanId>("maximo");

  useEffect(() => {
    setPlan(planoDaEmpresa(empresaId, "maximo"));
    return subscribeEmpresaPlanos(() => {
      setPlan(planoDaEmpresa(empresaId, "maximo"));
    });
  }, [empresaId]);

  return useMemo(
    () => ({
      plan,
      empresaId,
      isMaximo: plan === "maximo" || isSuperAdmin,
      canHref: (href: string) => isSuperAdmin || hrefLiberado(href, plan),
    }),
    [plan, empresaId, isSuperAdmin]
  );
}
