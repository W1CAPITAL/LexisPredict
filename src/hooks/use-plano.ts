"use client";

import { useEffect, useMemo, useState } from "react";
import { useAdmin } from "@/hooks/use-admin";
import { hrefLiberado, type PlanId, normalizePlanId } from "@/lib/planos-pacotes";
import { planoDaEmpresa, savePlanoEmpresa, subscribeEmpresaPlanos } from "@/lib/planos-store";
import {
  daysLeft,
  getAssinatura,
  isExpired,
  formatExpira,
  saveAssinatura,
  subscribeAssinaturas,
  type AssinaturaStatus,
} from "@/lib/planos-assinatura";
import { getMinhaAssinaturaAction } from "@/app/actions/planos-actions";

export function usePlano() {
  const { profile, isSuperAdmin } = useAdmin();
  const empresaId = profile?.empresa_id || "";
  const [plan, setPlan] = useState<PlanId>("maximo");
  const [ass, setAss] = useState<AssinaturaStatus>(() =>
    getAssinatura(empresaId, { plan: "maximo", expiresAt: null, blocked: false })
  );
  const [serverLoaded, setServerLoaded] = useState(false);

  useEffect(() => {
    const syncLocal = () => {
      setPlan(planoDaEmpresa(empresaId, "maximo"));
      setAss(getAssinatura(empresaId, { plan: "maximo", expiresAt: null, blocked: false }));
    };
    syncLocal();
    const u1 = subscribeEmpresaPlanos(syncLocal);
    const u2 = subscribeAssinaturas(syncLocal);
    return () => {
      u1();
      u2();
    };
  }, [empresaId]);

  useEffect(() => {
    if (!empresaId) return;
    let live = true;
    const pull = async () => {
      const res = await getMinhaAssinaturaAction().catch(() => null);
      if (!live) return;

      // Falha de rede / colunas ausentes: NÃO libera. Mantém estado local.
      if (!res?.ok) {
        setServerLoaded(true);
        return;
      }

      const serverBlocked = !!res.blocked;
      const next: AssinaturaStatus = {
        plan: normalizePlanId(res.plan || "maximo"),
        expiresAt: res.expiresAt ?? null,
        blocked: serverBlocked,
        blockedReason: res.blockedReason || undefined,
        origem: "server",
      };

      // Só grava local o que o servidor confirmou (não inventa liberação)
      saveAssinatura(empresaId, next);
      savePlanoEmpresa(empresaId, next.plan, {
        expiresAt: next.expiresAt,
        blocked: next.blocked,
        blockedReason: next.blockedReason || "",
        origem: "server",
      });
      setPlan(next.plan);
      setAss(next);
      setServerLoaded(true);
    };
    pull();
    const id = window.setInterval(pull, 20_000);
    return () => {
      live = false;
      window.clearInterval(id);
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
      serverLoaded,
      isMaximo: plan === "maximo" || isSuperAdmin,
      canHref: (href: string) => {
        if (isSuperAdmin) return true;
        if (locked) {
          return href.startsWith("/settings") || href === "/" || href.startsWith("/superadmin");
        }
        return hrefLiberado(href, plan);
      },
    }),
    [plan, empresaId, ass, left, expired, blocked, locked, isSuperAdmin, serverLoaded]
  );
}
