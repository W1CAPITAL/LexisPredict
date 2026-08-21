"use client";

import { useEffect, useMemo, useState } from "react";
import { useAdmin } from "@/hooks/use-admin";
import { hrefLiberado, type PlanId } from "@/lib/planos-pacotes";
import { planoDaEmpresa, subscribeEmpresaPlanos } from "@/lib/planos-store";
import {
  daysLeft,
  getAssinatura,
  isExpired,
  formatExpira,
  subscribeAssinaturas,
  type AssinaturaStatus,
} from "@/lib/planos-assinatura";

export function usePlano() {
  const { profile, isSuperAdmin } = useAdmin();
  const empresaId = profile?.empresa_id || "";
  const [plan, setPlan] = useState<PlanId>("maximo");
  const [ass, setAss] = useState<AssinaturaStatus>(() =>
    getAssinatura(empresaId, { plan: "maximo", expiresAt: null, blocked: false })
  );

  useEffect(() => {
    const sync = () => {
      setPlan(planoDaEmpresa(empresaId, "maximo"));
      setAss(getAssinatura(empresaId, { plan: "maximo", expiresAt: null, blocked: false }));
    };
    sync();
    const u1 = subscribeEmpresaPlanos(sync);
    const u2 = subscribeAssinaturas(sync);
    return () => {
      u1();
      u2();
    };
  }, [empresaId]);

  const left = daysLeft(ass.expiresAt);
  const expired = !isSuperAdmin && isExpired(ass.expiresAt);
  const blocked = !isSuperAdmin && !!ass.blocked;
  const locked = blocked || expired;

  return useMemo(
    () => ({
      plan,
      empresaId,
      assinatura: ass,
      expiresAt: ass.expiresAt,
      daysLeft: left,
      expiresLabel: formatExpira(ass.expiresAt),
      isExpired: expired,
      isBlocked: blocked,
      isLocked: locked,
      isMaximo: plan === "maximo" || isSuperAdmin,
      canHref: (href: string) => {
        if (isSuperAdmin) return true;
        if (locked) {
          return href.startsWith("/settings") || href === "/";
        }
        return hrefLiberado(href, plan);
      },
    }),
    [plan, empresaId, ass, left, expired, blocked, locked, isSuperAdmin]
  );
}
