"use client";
import { usePlano } from '@/hooks/use-plano';
import { PLAN_LABEL, PLAN_BLURB, PLAN_PACOTES } from '@/lib/planos-pacotes';
import { ShieldCheck } from 'lucide-react';

export function PlanosEmpresaPanel() {
  const { plan, isExpired, isBlocked, expiresLabel } = usePlano();
  return <section aria-labelledby="subscription-title" className="space-y-5">
    <div><h2 id="subscription-title" className="text-lg font-semibold">Assinatura da empresa</h2><p className="mt-1 text-sm text-muted-foreground">Plano e recursos disponíveis para sua equipe.</p></div>
    <dl className="divide-y rounded-xl border bg-card px-5 text-sm">
      <div className="flex flex-wrap justify-between gap-3 py-4"><dt className="text-muted-foreground">Plano atual</dt><dd className="font-semibold">{PLAN_LABEL[plan]}</dd></div>
      <div className="flex flex-wrap justify-between gap-3 py-4"><dt className="text-muted-foreground">Situação</dt><dd>{isBlocked ? 'Bloqueado' : isExpired ? 'Vencido' : 'Ativo'}</dd></div>
      <div className="flex flex-wrap justify-between gap-3 py-4"><dt className="text-muted-foreground">Validade</dt><dd>{expiresLabel || 'Não informada'}</dd></div>
    </dl>
    <p className="text-sm">{PLAN_BLURB[plan]}</p>
    <ul className="space-y-2">{PLAN_PACOTES[plan].map(p => <li key={p} className="flex items-center gap-2 text-sm"><ShieldCheck className="h-4 w-4 text-primary"/>{PLAN_LABEL[p]}</li>)}</ul>
    <p className="text-sm text-muted-foreground">Valores e condições: consulte o contrato da empresa ou o responsável pela assinatura.</p>
  </section>;
}
