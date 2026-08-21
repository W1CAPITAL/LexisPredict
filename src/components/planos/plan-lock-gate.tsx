"use client";

import { useEffect, useState } from "react";
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
  saveAssinatura,
  getAssinatura,
} from "@/lib/planos-assinatura";
import { savePlanoEmpresa } from "@/lib/planos-store";
import { normalizePlanId } from "@/lib/planos-pacotes";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Crown, Lock, MessageCircle, RefreshCw, Loader2 } from "lucide-react";
import { getMinhaAssinaturaAction } from "@/app/actions/planos-actions";
import { useToast } from "@/hooks/use-toast";
import { invalidateCarteiraCache, clearScanProgress } from "@/lib/session-carteira-cache";

/**
 * Bloqueado = NÃO monta children (sem cache de processos, sem lag).
 * Só Superadmin libera no servidor.
 */
export function PlanLockGate({ children }: { children: React.ReactNode }) {
  const { isSuperAdmin, profile } = useAdmin();
  const {
    isLocked,
    isBlocked,
    expiresAt,
    plan,
    empresaId,
    serverLoaded,
    assinatura,
  } = usePlano();
  const pathname = usePathname() || "/";
  const { toast } = useToast();
  const [checking, setChecking] = useState(false);

  // Se local já diz bloqueado, limpa cache pesado imediatamente
  useEffect(() => {
    if (isSuperAdmin || !empresaId) return;
    const local = getAssinatura(empresaId);
    if (local.blocked || isLocked) {
      try {
        invalidateCarteiraCache();
        clearScanProgress();
      } catch {
        /* */
      }
    }
  }, [empresaId, isSuperAdmin, isLocked]);

  

  if (isSuperAdmin) return <>{children}</>;
  if (rotaPermitidaSemPlano(pathname)) return <>{children}</>;

  // Enquanto não souber: NÃO monta carteira/processos (evita cache + lag no F5)
  if (!serverLoaded) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-background p-6">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
          Verificando acesso da empresa…
        </p>
        <p className="text-xs text-muted-foreground text-center max-w-sm">
          Não carregamos processos nem cache até confirmar o plano.
        </p>
      </div>
    );
  }

  if (!isLocked) return <>{children}</>;

  const wa = whatsappProprietarioUrl(
    isBlocked
      ? "Olá, meu acesso ao LexisPredict foi BLOQUEADO. Já paguei e preciso liberação do proprietário no Superadmin."
      : "Olá, meu plano LexisPredict EXPIROU. Preciso renovação liberada pelo proprietário."
  );

  const motivo =
    assinatura?.blockedReason ||
    (isBlocked ? "inadimplência / falta de pagamento" : "prazo do plano esgotado");

  const verificarPagamento = async () => {
    if (!empresaId) return;
    setChecking(true);
    try {
      const res = await getMinhaAssinaturaAction();
      if (!res?.ok) {
        toast({
          title: "Ainda bloqueado",
          description: "Só o Superadmin libera no servidor.",
          variant: "destructive",
        });
        return;
      }
      saveAssinatura(empresaId, {
        plan: normalizePlanId(res.plan || "maximo"),
        expiresAt: res.expiresAt ?? null,
        blocked: !!res.blocked,
        blockedReason: res.blockedReason || undefined,
        origem: "server-check",
      });
      savePlanoEmpresa(empresaId, normalizePlanId(res.plan || "maximo"), {
        expiresAt: res.expiresAt ?? null,
        blocked: !!res.blocked,
        blockedReason: res.blockedReason || "",
        origem: "server-check",
      });

      if (res.blocked) {
        toast({
          title: "Ainda bloqueado",
          description: "O proprietário ainda não liberou no painel Superadmin.",
          variant: "destructive",
        });
        return;
      }
      const exp = res.expiresAt ? new Date(res.expiresAt).getTime() : null;
      if (exp !== null && exp < Date.now()) {
        toast({
          title: "Plano ainda expirado",
          description: "Aguardando renovação pelo Superadmin.",
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Acesso liberado", description: "Recarregando…" });
      window.setTimeout(() => window.location.reload(), 600);
    } catch {
      toast({
        title: "Ainda bloqueado",
        description: "Erro ao consultar o servidor.",
        variant: "destructive",
      });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background p-4 sm:p-8">
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
            Processos e cache não são carregados neste estado. Só o Superadmin libera após confirmar o pagamento.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-muted/40 p-4 text-left space-y-2 text-xs">
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground font-bold uppercase">Motivo</span>
            <span className="font-semibold text-right">{motivo}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground font-bold uppercase">Plano</span>
            <span className="font-black uppercase">{plan}</span>
          </div>
          {expiresAt && (
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground font-bold uppercase">Validade</span>
              <span className="font-semibold">{formatExpira(expiresAt)}</span>
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-left space-y-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
            Liberação
          </p>
          <p className="text-sm font-bold">{PROPRIETARIO_LABEL}</p>
          <p className="text-sm tabular-nums font-semibold">WhatsApp {PROPRIETARIO_WHATSAPP}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            asChild
            className="flex-1 h-12 font-black uppercase text-[10px] tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <a href={wa} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="mr-2 h-4 w-4" />
              WhatsApp
            </a>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1 h-12 font-black uppercase text-[10px] tracking-widest"
            disabled={checking}
            onClick={verificarPagamento}
          >
            {checking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Só verificar servidor
          </Button>
        </div>
        <Button asChild variant="ghost" size="sm" className="text-[10px] font-bold uppercase tracking-widest">
          <Link href="/settings">
            <Crown className="mr-1.5 h-3.5 w-3.5" />
            Planos / Pix
          </Link>
        </Button>
      </div>
    </div>
  );
}
