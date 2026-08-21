"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePlano } from "@/hooks/use-plano";
import { useAdmin } from "@/hooks/use-admin";
import {
  PROPRIETARIO_LABEL,
  PROPRIETARIO_WHATSAPP,
  rotaPermitidaSemPlano,
  whatsappProprietarioUrl,
  formatExpira,
} from "@/lib/planos-assinatura";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Crown, Lock, MessageCircle, RefreshCw } from "lucide-react";
import { getMinhaAssinaturaAction } from "@/app/actions/planos-actions";
import {
  saveAssinatura,
} from "@/lib/planos-assinatura";
import { savePlanoEmpresa } from "@/lib/planos-store";
import { normalizePlanId } from "@/lib/planos-pacotes";

/**
 * Trava a UI com tela explícita de bloqueio/expiração.
 * Superadmin nunca é bloqueado (pode liberar planos).
 */
export function PlanLockGate({ children }: { children: React.ReactNode }) {
  const { isSuperAdmin, profile } = useAdmin();
  const {
    isLocked,
    isBlocked,
    isExpired,
    expiresAt,
    plan,
    empresaId,
    serverLoaded,
    assinatura,
  } = usePlano();
  const pathname = usePathname() || "/";

  // Revalida no servidor a cada 25s (usuário já logado passa a ver o bloqueio)
  useEffect(() => {
    if (isSuperAdmin || !empresaId) return;
    let live = true;
    const tick = async () => {
      try {
        const res = await getMinhaAssinaturaAction();
        if (!live || !res?.ok) return;
        saveAssinatura(empresaId, {
          plan: normalizePlanId(res.plan || "maximo"),
          expiresAt: res.expiresAt ?? null,
          blocked: !!res.blocked,
          blockedReason: res.blockedReason || undefined,
          origem: "server-poll",
        });
        savePlanoEmpresa(empresaId, normalizePlanId(res.plan || "maximo"), {
          expiresAt: res.expiresAt ?? null,
          blocked: !!res.blocked,
          blockedReason: res.blockedReason || "",
          origem: "server-poll",
        });
      } catch {
        /* ignore */
      }
    };
    tick();
    const id = window.setInterval(tick, 25_000);
    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      live = false;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [empresaId, isSuperAdmin]);

  if (isSuperAdmin) {
    return <>{children}</>;
  }

  // Login / rotas públicas
  if (rotaPermitidaSemPlano(pathname)) {
    return <>{children}</>;
  }

  // Ainda carregando status do servidor: não mostra tela preta vazia
  if (!serverLoaded) {
    return (
      <>
        {children}
        <div className="fixed bottom-3 right-3 z-[90] rounded-full border bg-card/95 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground shadow-lg">
          Verificando plano…
        </div>
      </>
    );
  }

  if (!isLocked) {
    return <>{children}</>;
  }

  const wa = whatsappProprietarioUrl(
    isBlocked
      ? "Olá, meu acesso ao LexisPredict foi BLOQUEADO por falta de pagamento. Preciso que liberem a empresa."
      : "Olá, meu plano LexisPredict EXPIROU e preciso renovar para continuar usando o app."
  );

  const motivo =
    assinatura?.blockedReason ||
    (isBlocked ? "inadimplência / falta de pagamento" : "prazo do plano esgotado");

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-md p-4 sm:p-8">
      <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 via-transparent to-amber-500/5 pointer-events-none" />
      <div className="relative max-w-lg w-full rounded-3xl border-2 border-red-500/40 bg-card shadow-2xl p-6 sm:p-8 space-y-5 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/15 ring-2 ring-red-500/30">
          {isBlocked ? (
            <Lock className="text-red-600 dark:text-red-400" size={28} />
          ) : (
            <AlertTriangle className="text-amber-600 dark:text-amber-400" size={28} />
          )}
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-red-600 dark:text-red-400">
            LexisPredict · acesso restrito
          </p>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight uppercase">
            {isBlocked ? "Empresa bloqueada" : "Plano expirado"}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
            {isBlocked
              ? "O Superadmin bloqueou esta empresa. Todas as funções (carteira, scanner, WhatsApp, peças) ficam indisponíveis até a liberação após o pagamento."
              : `O plano ${String(plan).toUpperCase()} encerrou em ${formatExpira(expiresAt)}. É necessário renovar para continuar.`}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-muted/40 p-4 text-left space-y-2">
          <div className="flex justify-between gap-2 text-xs">
            <span className="text-muted-foreground font-bold uppercase tracking-wider">Motivo</span>
            <span className="font-semibold text-right">{motivo}</span>
          </div>
          <div className="flex justify-between gap-2 text-xs">
            <span className="text-muted-foreground font-bold uppercase tracking-wider">Plano</span>
            <span className="font-black uppercase">{plan}</span>
          </div>
          {expiresAt && (
            <div className="flex justify-between gap-2 text-xs">
              <span className="text-muted-foreground font-bold uppercase tracking-wider">Validade</span>
              <span className="font-semibold">{formatExpira(expiresAt)}</span>
            </div>
          )}
          {profile?.nome && (
            <div className="flex justify-between gap-2 text-xs">
              <span className="text-muted-foreground font-bold uppercase tracking-wider">Usuário</span>
              <span className="font-semibold truncate max-w-[200px]">{profile.nome}</span>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-left space-y-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
            Como liberar
          </p>
          <p className="text-sm font-bold">{PROPRIETARIO_LABEL}</p>
          <p className="text-sm tabular-nums font-semibold">WhatsApp {PROPRIETARIO_WHATSAPP}</p>
          <p className="text-[11px] text-muted-foreground">
            Após o pagamento, o proprietário libera o plano e o prazo no painel Superadmin. Esta tela some sozinha em até ~25 segundos.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            asChild
            className="flex-1 h-12 font-black uppercase text-[10px] tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <a href={wa} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="mr-2 h-4 w-4" />
              Falar no WhatsApp
            </a>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1 h-12 font-black uppercase text-[10px] tracking-widest"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Já paguei · atualizar
          </Button>
        </div>

        <p className="text-[10px] text-muted-foreground">
          Superadmin continua com acesso total para alterar o plano da empresa.
        </p>

        <Button asChild variant="ghost" size="sm" className="text-[10px] font-bold uppercase tracking-widest">
          <Link href="/settings">
            <Crown className="mr-1.5 h-3.5 w-3.5" />
            Configurações / upgrade
          </Link>
        </Button>
      </div>
    </div>
  );
}
