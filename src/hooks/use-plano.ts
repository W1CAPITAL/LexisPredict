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
import { invalidateCarteiraCache, clearScanProgress } from "@/lib/session-carteira-cache";

export function usePlano() {
  const { profile, isSuperAdmin } = useAdmin();
  const empresaId = profile?.empresa_id || "";

  const [plan, setPlan] = useState<PlanId>(() =>
    empresaId ? planoDaEmpresa(empresaId, "maximo") : "maximo"
  );
  const [ass, setAss] = useState<AssinaturaStatus>(() =>
    getAssinatura(empresaId, { plan: "maximo", expiresAt: null, blocked: false })
  );
  const [serverLoaded, setServerLoaded] = useState(false);

  useEffect(() => {
    const local = getAssinatura(empresaId, { plan: "maximo", expiresAt: null, blocked: false });
    setPlan(planoDaEmpresa(empresaId, local.plan || "maximo"));
    setAss(local);
    const u1 = subscribeEmpresaPlanos(() => {
      setPlan(planoDaEmpresa(empresaId, "maximo"));
      setAss(getAssinatura(empresaId, { plan: "maximo", expiresAt: null, blocked: false }));
    });
    const u2 = subscribeAssinaturas(() => {
      setAss(getAssinatura(empresaId, { plan: "maximo", expiresAt: null, blocked: false }));
      setPlan(planoDaEmpresa(empresaId, "maximo"));
    });
    return () => {
      u1();
      u2();
    };
  }, [empresaId]);

  useEffect(() => {
    if (!empresaId) {
      setServerLoaded(true);
      return;
    }
    let live = true;
    const pull = async () => {
      const res = await getMinhaAssinaturaAction().catch(() => null);
      if (!live) return;
      if (!res?.ok) {
        // Mantém local (se estava bloqueado, continua)
        setServerLoaded(true);
        return;
      }
      const next: AssinaturaStatus = {
        plan: normalizePlanId(res.plan || "maximo"),
        expiresAt: res.expiresAt ?? null,
        blocked: !!res.blocked,
        blockedReason: res.blockedReason || undefined,
        origem: "server",
      };
      if (next.blocked) {
        try {
          invalidateCarteiraCache();
          clearScanProgress();
        } catch {
          /* */
        }
      }
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
    // Poll mais lento se já bloqueado (só para detectar liberação)
    const id = window.setInterval(pull, 30_000);
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
