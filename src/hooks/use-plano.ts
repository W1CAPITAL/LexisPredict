"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAdmin } from "@/hooks/use-admin";
import { useAuth } from "@/components/auth/auth-provider";
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
import { saveNavLayout, type NavLayoutMode } from "@/lib/nav-layout";

const CLEAN_FALLBACK: AssinaturaStatus = {
  plan: "essencial",
  expiresAt: null,
  blocked: true,
  blockedReason: "validating_subscription",
  origem: "fallback",
};

type CommercialState = Awaited<ReturnType<typeof getMinhaAssinaturaAction>>;
const PLAN_STATE_TTL_MS = 2 * 60 * 1000;
const VALIDATED_LOCAL_TTL_MS = 2 * 60 * 1000;
const planStateCache = new Map<string, { at: number; value: CommercialState }>();
const planStateInflight = new Map<string, Promise<CommercialState>>();

async function fetchCommercialState(empresaId: string): Promise<CommercialState> {
  const cached = planStateCache.get(empresaId);
  if (cached && Date.now() - cached.at < PLAN_STATE_TTL_MS) return cached.value;

  const inflight = planStateInflight.get(empresaId);
  if (inflight) return inflight;

  const request = (async (): Promise<CommercialState> => {
    try {
      // Do not probe every optional commercial column from the browser:
      // older tenant databases reject the first SELECT with HTTP 400.
      // The server action handles legacy schemas and owns billing authorization.
      return await getMinhaAssinaturaAction();
    } finally {
      planStateInflight.delete(empresaId);
    }
  })();

  planStateInflight.set(empresaId, request);
  const value = await request;
  if (value?.ok) planStateCache.set(empresaId, { at: Date.now(), value });
  return value;
}

export function usePlano() {
  const { user, loading: authLoading } = useAuth();
  const { profile, isSuperAdmin } = useAdmin();
  const empresaId = profile?.empresa_id || "";

  const [plan, setPlan] = useState<PlanId>(() =>
    empresaId ? planoDaEmpresa(empresaId, "essencial") : "essencial"
  );
  const [ass, setAss] = useState<AssinaturaStatus>(() =>
    getAssinatura(empresaId, CLEAN_FALLBACK)
  );
  const [serverLoaded, setServerLoaded] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [billingStatus, setBillingStatus] = useState<string | null>(null);
  const [selfServiceUnlocked, setSelfServiceUnlocked] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [navLayout, setNavLayout] = useState<NavLayoutMode>("dock");
  const [sidebarCompact, setSidebarCompact] = useState(false);
  const blockedRef = useRef(false);

  useEffect(() => {
    const local = getAssinatura(empresaId, CLEAN_FALLBACK);
    setPlan(planoDaEmpresa(empresaId, local.plan || "essencial"));
    setAss(local);
    blockedRef.current = !!local.blocked;

    const syncLocal = () => {
      const next = getAssinatura(empresaId, CLEAN_FALLBACK);
      setAss(next);
      setPlan(planoDaEmpresa(empresaId, "essencial"));
      blockedRef.current = !!next.blocked;
    };

    const u1 = subscribeEmpresaPlanos(syncLocal);
    const u2 = subscribeAssinaturas(syncLocal);
    return () => {
      u1();
      u2();
    };
  }, [empresaId]);

  useEffect(() => {
    // Nenhuma decisão comercial enquanto a sessão/perfil ainda está carregando.
    if (authLoading || (user && !profile)) {
      setServerLoaded(false);
      setSetupRequired(false);
      setServerError(null);
      return;
    }

    // Sem sessão autenticada não existe assinatura a validar.
    if (!user) {
      setServerLoaded(false);
      setSetupRequired(false);
      setServerError(null);
      setBillingStatus(null);
      setSelfServiceUnlocked(false);
      setOnboardingCompleted(false);
      return;
    }

    if (isSuperAdmin) {
      setSetupRequired(false);
      setServerError(null);
      setBillingStatus("active");
      setSelfServiceUnlocked(false);
      setOnboardingCompleted(true);
      setServerLoaded(true);
      return;
    }

    if (!empresaId) {
      setSetupRequired(true);
      setServerError("Empresa ainda não vinculada ao perfil.");
      setServerLoaded(true);
      setAss(CLEAN_FALLBACK);
      setPlan("essencial");
      setBillingStatus(null);
      setSelfServiceUnlocked(false);
      setOnboardingCompleted(false);
      return;
    }

    // Em reload/navegação interna, um status recentemente confirmado pode
    // liberar a UI imediatamente enquanto revalidamos em background.
    const cachedAss = getAssinatura(empresaId, CLEAN_FALLBACK);
    const hasFreshValidatedCache =
      cachedAss.origem === "server" &&
      typeof cachedAss.validatedAt === "number" &&
      Date.now() - cachedAss.validatedAt < VALIDATED_LOCAL_TTL_MS;

    setServerLoaded(hasFreshValidatedCache);
    setServerError(null);

    let live = true;

    const pull = async () => {
      let res: Awaited<ReturnType<typeof getMinhaAssinaturaAction>> | null = null;
      try {
        res = await fetchCommercialState(empresaId);
      } catch {
        res = null;
      }
      if (!live) return;

      if (!res?.ok) {
        setSetupRequired(!!res?.setupRequired);
        setServerError(res?.error || "Não foi possível validar a assinatura agora.");
        setBillingStatus(null);
        setServerLoaded(true);
        return;
      }

      const next: AssinaturaStatus = {
        plan: normalizePlanId(res.plan || "essencial"),
        expiresAt: res.expiresAt ?? null,
        blocked: !!res.blocked,
        blockedReason: res.blockedReason || undefined,
        origem: "server",
        validatedAt: Date.now(),
      };

      setSetupRequired(false);
      setServerError(null);
      setBillingStatus(res.billingStatus ?? null);
      setSelfServiceUnlocked(!!res.selfServiceUnlocked);
      setOnboardingCompleted(!!res.onboardingCompleted);
      const serverNav: NavLayoutMode = res.navLayout === "vertical" ? "vertical" : "dock";
      setNavLayout(serverNav);
      setSidebarCompact(!!res.sidebarCompact);
      blockedRef.current = next.blocked;

      if (res.onboardingCompleted) {
        saveNavLayout(serverNav);
        try {
          localStorage.setItem("lexis-sidebar-compact-v2", res.sidebarCompact ? "1" : "0");
          window.dispatchEvent(
            new CustomEvent("lexis-nav-display", {
              detail: { compact: !!res.sidebarCompact },
            })
          );
        } catch {}
      }

      if (next.blocked) {
        try {
          invalidateCarteiraCache();
          clearScanProgress();
        } catch {
          /* cache best effort */
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

    void pull();

    // Sem reconsulta a cada focus/tab. O middleware continua protegendo navegação,
    // e uma revalidação leve a cada 10 min cobre mudanças comerciais em sessão longa.
    const id = window.setInterval(() => {
      planStateCache.delete(empresaId);
      void pull();
    }, 10 * 60_000);

    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, [empresaId, profile, isSuperAdmin, user, authLoading]);

  const left = daysLeft(ass.expiresAt);
  const subscriptionAuthoritative =
    !!user &&
    !!profile &&
    !!empresaId &&
    serverLoaded &&
    !setupRequired &&
    !serverError;

  const expired =
    subscriptionAuthoritative &&
    !isSuperAdmin &&
    isExpired(ass.expiresAt);

  const blocked =
    subscriptionAuthoritative &&
    !isSuperAdmin &&
    !!ass.blocked;

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
      setupRequired,
      serverError,
      serverLoaded,
      subscriptionAuthoritative,
      billingStatus,
      selfServiceUnlocked,
      onboardingCompleted,
      navLayout,
      sidebarCompact,
      isMaximo: plan === "maximo" || isSuperAdmin,
      canHref: (href: string) => {
        if (isSuperAdmin) return true;
        if (setupRequired) return href.startsWith("/settings") || href === "/onboarding";
        if (locked) {
          return href.startsWith("/settings") || href === "/" || href.startsWith("/superadmin");
        }
        return hrefLiberado(href, plan);
      },
    }),
    [plan, empresaId, ass, left, expired, blocked, locked, setupRequired, serverError, isSuperAdmin, serverLoaded, subscriptionAuthoritative, billingStatus, selfServiceUnlocked, onboardingCompleted, navLayout, sidebarCompact]
  );
}
