"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePlano } from "@/hooks/use-plano";
import { useAuth } from "@/components/auth/auth-provider";
import { useAdmin } from "@/hooks/use-admin";
import {
  PROPRIETARIO_LABEL,
  PROPRIETARIO_WHATSAPP,
  rotaPermitidaSemPlano,
  whatsappProprietarioUrl,
  formatExpira,
  saveAssinatura,
} from "@/lib/planos-assinatura";
import { savePlanoEmpresa } from "@/lib/planos-store";
import { normalizePlanId } from "@/lib/planos-pacotes";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Crown,
  Lock,
  MessageCircle,
  RefreshCw,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { getMinhaAssinaturaAction } from "@/app/actions/planos-actions";
import { useToast } from "@/hooks/use-toast";
import { invalidateCarteiraCache, clearScanProgress } from "@/lib/session-carteira-cache";

export function PlanLockGate({ children }: { children: React.ReactNode }) {
  const { user, profile, loading: authLoading } = useAuth();
  const { isSuperAdmin } = useAdmin();
  const {
    isLocked,
    isBlocked,
    expiresAt,
    plan,
    empresaId,
    serverLoaded,
    setupRequired,
    serverError,
    assinatura,
  } = usePlano();
  const pathname = usePathname() || "/";
  const { toast } = useToast();
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (isSuperAdmin || !empresaId || setupRequired || !isLocked) return;
    try {
      invalidateCarteiraCache();
      clearScanProgress();
    } catch {
      /* cache best effort */
    }
  }, [empresaId, isSuperAdmin, isLocked, setupRequired]);

  // Login, cadastro, termos e rotas de resolução de acesso nunca podem
  // ser bloqueados por assinatura.
  if (rotaPermitidaSemPlano(pathname)) return <>{children}</>;

  // O gate comercial só existe depois que o Supabase confirmou uma sessão.
  // Sem login, deixa o SessionGuard cuidar do redirecionamento das rotas privadas.
  if (authLoading) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-background p-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border bg-card shadow-sm">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
        <div className="space-y-1 text-center">
          <p className="text-sm font-semibold">Verificando sessão</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Validando seu acesso com segurança.
          </p>
        </div>
      </div>
    );
  }

  if (!user) return <>{children}</>;
  if (isSuperAdmin) return <>{children}</>;

  // Sessão já existe, mas o perfil ainda não chegou do Supabase.
  // Isso é carregamento — nunca suspensão de assinatura.
  if (user && !profile) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-background p-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border bg-card shadow-sm">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
        <div className="space-y-1 text-center">
          <p className="text-sm font-semibold">Carregando seu perfil</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Identificando empresa e permissões da sua conta.
          </p>
        </div>
      </div>
    );
  }

  // Perfil existe, mas o tenant ainda está sendo resolvido.
  if (!empresaId && !setupRequired) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-background p-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border bg-card shadow-sm">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
        <div className="space-y-1 text-center">
          <p className="text-sm font-semibold">Preparando sua empresa</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Carregando o ambiente comercial vinculado ao seu usuário.
          </p>
        </div>
      </div>
    );
  }

  if (!serverLoaded && !setupRequired) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-background p-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border bg-card shadow-sm">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
        <div className="space-y-1 text-center">
          <p className="text-sm font-semibold">Validando sua assinatura</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Confirmando o status diretamente no servidor.
          </p>
        </div>
      </div>
    );
  }

  // Falha de rede/validação não pode ser apresentada como inadimplência.
  if (serverError && !setupRequired) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-lg rounded-[24px] border bg-card p-6 shadow-xl">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </div>
          <h1 className="mt-5 text-xl font-black">Não foi possível validar seu acesso</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Sua assinatura não foi marcada como suspensa. O servidor apenas não conseguiu confirmar o status neste momento.
          </p>
          <p className="mt-3 rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
            {serverError}
          </p>
          <Button
            type="button"
            className="mt-5 w-full"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  if (setupRequired) {
    return (
      <div className="fixed inset-0 z-[100] overflow-y-auto bg-background p-4 sm:p-8">
        <div className="mx-auto flex min-h-full max-w-3xl items-center justify-center">
          <div className="relative w-full overflow-hidden rounded-[28px] border bg-card shadow-2xl">
            <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-r from-primary/15 via-sky-500/10 to-violet-500/15" />
            <div className="relative p-6 sm:p-9">
              <div className="mb-7 flex items-start justify-between gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border bg-background/85 shadow-sm backdrop-blur">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <span className="rounded-full border bg-background/80 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Configuração inicial
                </span>
              </div>

              <div className="max-w-xl space-y-3">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-primary">
                  Ambiente comercial
                </p>
                <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
                  Sua conta ainda não está vinculada a uma empresa
                </h1>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Isso não é bloqueio, inadimplência nem plano vencido. O banco está pronto, mas ainda falta existir
                  uma empresa vinculada ao seu perfil para carregar carteira, permissões e assinatura.
                </p>
              </div>

              <div className="mt-7 grid gap-3 sm:grid-cols-3">
                {[
                  ["1", "Empresa", "Cadastrar ou vincular o tenant"],
                  ["2", "Plano", "Escolher o pacote comercial"],
                  ["3", "Acesso", "Começar com a carteira limpa"],
                ].map(([n, title, desc]) => (
                  <div key={n} className="rounded-2xl border bg-background/60 p-4">
                    <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-xs font-black text-primary">
                      {n}
                    </div>
                    <p className="text-sm font-bold">{title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{desc}</p>
                  </div>
                ))}
              </div>

              {serverError ? (
                <div className="mt-5 rounded-2xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
                  {serverError}
                </div>
              ) : null}

              <div className="mt-7 flex flex-col gap-2 sm:flex-row">
                <Button asChild className="h-11 flex-1 font-semibold">
                  <Link href="/settings?setup=tenant">
                    Abrir configurações
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-11 flex-1">
                  <Link href="/signup">
                    Criar nova empresa
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isLocked) return <>{children}</>;

  const wa = whatsappProprietarioUrl(
    isBlocked
      ? "Olá, meu acesso ao LexisPredict está bloqueado no servidor e preciso revisar a assinatura."
      : "Olá, meu plano LexisPredict expirou e preciso renovar a assinatura."
  );

  const rawMotivo = assinatura?.blockedReason || "";
  const motivo =
    rawMotivo === "validating_subscription"
      ? "assinatura ainda não validada pelo servidor"
      : rawMotivo ||
        (isBlocked ? "assinatura suspensa no servidor" : "prazo do plano esgotado");

  const verificarPagamento = async () => {
    if (!empresaId) return;
    setChecking(true);
    try {
      const res = await getMinhaAssinaturaAction();

      if (!res?.ok) {
        toast({
          title: res?.setupRequired ? "Empresa ainda não configurada" : "Não foi possível confirmar",
          description: res?.error || "Tente novamente em instantes.",
          variant: res?.setupRequired ? "default" : "destructive",
        });
        if (res?.setupRequired) window.setTimeout(() => window.location.reload(), 300);
        return;
      }

      saveAssinatura(empresaId, {
        plan: normalizePlanId(res.plan || "essencial"),
        expiresAt: res.expiresAt ?? null,
        blocked: !!res.blocked,
        blockedReason: res.blockedReason || undefined,
        origem: "server-check",
      });
      savePlanoEmpresa(empresaId, normalizePlanId(res.plan || "essencial"), {
        expiresAt: res.expiresAt ?? null,
        blocked: !!res.blocked,
        blockedReason: res.blockedReason || "",
        origem: "server-check",
      });

      if (res.blocked) {
        toast({
          title: "Assinatura ainda suspensa",
          description: "O status do servidor ainda não foi liberado.",
          variant: "destructive",
        });
        return;
      }

      const exp = res.expiresAt ? new Date(res.expiresAt).getTime() : null;
      if (exp !== null && exp < Date.now()) {
        toast({
          title: "Plano ainda expirado",
          description: "A data de validade ainda precisa ser renovada.",
          variant: "destructive",
        });
        return;
      }

      toast({ title: "Acesso confirmado", description: "Recarregando o ambiente…" });
      window.setTimeout(() => window.location.reload(), 500);
    } catch {
      toast({
        title: "Falha na verificação",
        description: "Não foi possível consultar o servidor agora.",
        variant: "destructive",
      });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-background p-4 sm:p-8">
      <div className="mx-auto flex min-h-full max-w-3xl items-center justify-center">
        <div className="relative w-full overflow-hidden rounded-[28px] border bg-card shadow-2xl">
          <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-r from-red-500/10 via-amber-500/5 to-transparent" />
          <div className="relative p-6 sm:p-9">
            <div className="mb-7 flex items-start justify-between gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border bg-background/85 shadow-sm">
                {isBlocked ? (
                  <Lock className="h-6 w-6 text-red-500" />
                ) : (
                  <AlertTriangle className="h-6 w-6 text-amber-500" />
                )}
              </div>
              <span className="rounded-full border bg-background/80 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Assinatura
              </span>
            </div>

            <div className="max-w-xl space-y-3">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-red-500">
                Acesso temporariamente restrito
              </p>
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
                {isBlocked ? "Assinatura suspensa" : "Plano expirado"}
              </h1>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Seus dados continuam preservados. O carregamento operacional fica pausado até a assinatura voltar ao estado ativo.
              </p>
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border bg-background/60 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Plano</p>
                <p className="mt-1 text-lg font-black capitalize">{plan}</p>
              </div>
              <div className="rounded-2xl border bg-background/60 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Status</p>
                <p className="mt-1 text-lg font-black">{isBlocked ? "Suspenso" : "Expirado"}</p>
              </div>
              <div className="rounded-2xl border bg-background/60 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Validade</p>
                <p className="mt-1 text-sm font-bold">{expiresAt ? formatExpira(expiresAt) : "Sem data"}</p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border bg-muted/35 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Motivo informado</p>
              <p className="mt-1 text-sm font-semibold">{motivo}</p>
            </div>

            <div className="mt-5 flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold">{PROPRIETARIO_LABEL}</p>
                <p className="text-xs text-muted-foreground">WhatsApp {PROPRIETARIO_WHATSAPP}</p>
              </div>
            </div>

            <div className="mt-7 grid gap-2 sm:grid-cols-2">
              <Button asChild className="h-11 bg-emerald-600 font-semibold text-white hover:bg-emerald-700">
                <a href={wa} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Falar com comercial
                </a>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 font-semibold"
                disabled={checking}
                onClick={verificarPagamento}
              >
                {checking ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Verificar novamente
              </Button>
            </div>

            <Button asChild variant="ghost" className="mt-2 w-full">
              <Link href="/settings">
                <Crown className="mr-2 h-4 w-4" />
                Ver planos e assinatura
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
