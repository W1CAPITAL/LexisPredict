"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
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
import { Crown, Lock, MessageCircle } from "lucide-react";

export function PlanLockGate({ children }: { children: React.ReactNode }) {
  const { isSuperAdmin } = useAdmin();
  const { isLocked, isBlocked, expiresAt, plan } = usePlano();
  const pathname = usePathname() || "/";

  if (isSuperAdmin || !isLocked || rotaPermitidaSemPlano(pathname)) {
    return <>{children}</>;
  }

  const wa = whatsappProprietarioUrl(
    isBlocked
      ? "Olá, meu acesso ao LexisPredict foi bloqueado por falta de pagamento. Preciso liberar a empresa."
      : "Olá, meu plano LexisPredict expirou e preciso renovar para continuar usando."
  );

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-3xl border border-border bg-card shadow-xl p-6 space-y-4 text-center">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center">
          <Lock className="text-red-600" size={22} />
        </div>
        <h1 className="text-lg font-black uppercase tracking-tight">
          {isBlocked ? "Acesso bloqueado" : "Plano expirado"}
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {isBlocked
            ? "Sua empresa foi bloqueada por falta de pagamento. As funções do app ficam indisponíveis até a liberação."
            : `O plano ${plan} encerrou em ${formatExpira(expiresAt)}. É necessário pagar a renovação para continuar.`}
        </p>
        <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-left space-y-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Liberação / renovação
          </p>
          <p className="text-sm font-bold">{PROPRIETARIO_LABEL}</p>
          <p className="text-sm tabular-nums">WhatsApp {PROPRIETARIO_WHATSAPP}</p>
        </div>
        <div className="flex flex-col gap-2">
          <Button asChild className="w-full h-11 font-black uppercase text-[10px] tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white">
            <a href={wa} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="mr-2 h-4 w-4" />
              Falar com o proprietário
            </a>
          </Button>
          <Button asChild variant="outline" className="w-full h-11 font-black uppercase text-[10px] tracking-widest">
            <Link href="/settings">
              <Crown className="mr-2 h-4 w-4" />
              Ir para Planos / Pix
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
