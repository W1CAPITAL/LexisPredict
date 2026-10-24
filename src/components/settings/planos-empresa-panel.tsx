"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {SubscriptionRenewalTermsContent} from "@/components/legal/SubscriptionRenewalTermsContent";
import {RENEWAL_TERMS_VERSION} from "@/lib/subscription-renewal";
import { usePlano } from "@/hooks/use-plano";
import { useAdmin } from "@/hooks/use-admin";
import {
  PLAN_IDS,
  PLAN_LABEL,
  PLAN_PACOTES,
  type PlanId,
} from "@/lib/planos-pacotes";
import {
  PLANOS_PRECOS,
  formatBRL,
  mensalDoAnual,
  economiaAnual,
} from "@/lib/planos-precos";
import {
  trocarMeuPlanoAction,
  salvarPlanoEmpresaAction,
  solicitarRenovacaoAssinaturaAction,
} from "@/app/actions/planos-actions";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Clock3,
  Crown,
  Loader2,
  MessageCircle,
  Minus,
  ShieldCheck,
  Sparkles,
  WalletCards,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PLAN_STYLE: Record<PlanId, {
  accent: string;
  iconWrap: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}> = {
  essencial: {
    accent: "from-slate-500/10 via-transparent to-transparent",
    iconWrap: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
    icon: ShieldCheck,
    label: "Base sólida",
  },
  operacional: {
    accent: "from-sky-500/15 via-cyan-500/5 to-transparent",
    iconWrap: "bg-sky-500/10 text-sky-600 dark:text-sky-300",
    icon: Zap,
    label: "Operação jurídica",
  },
  financeiro: {
    accent: "from-emerald-500/15 via-teal-500/5 to-transparent",
    iconWrap: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    icon: WalletCards,
    label: "Gestão financeira",
  },
  maximo: {
    accent: "from-violet-500/20 via-fuchsia-500/8 to-transparent",
    iconWrap: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
    icon: Crown,
    label: "Gabinete completo",
  },
};

const COMPARISON = [
  { label: "Carteira, tarefas, equipe e notas", essencial: true, operacional: true, financeiro: true, maximo: true },
  { label: "Importação e exportação XLSX/CSV", essencial: true, operacional: true, financeiro: true, maximo: true },
  { label: "DataJud, DJEN e scanner judicial", essencial: false, operacional: true, financeiro: false, maximo: true },
  { label: "Gerador de processos e automações", essencial: false, operacional: true, financeiro: false, maximo: true },
  { label: "BA, cumprimentos, peças, OCR e IA", essencial: false, operacional: true, financeiro: false, maximo: true },
  { label: "CRM, cobrança e funil comercial", essencial: false, operacional: false, financeiro: true, maximo: true },
  { label: "Finanças, cálculos e analytics", essencial: false, operacional: false, financeiro: true, maximo: true },
  { label: "Operacional + financeiro integrados", essencial: false, operacional: false, financeiro: false, maximo: true },
] as const;

export function PlanosEmpresaPanel() {
  const {
    plan,
    isExpired,
    isBlocked,
    expiresLabel,
    daysLeft,
    setupRequired,
    serverError,
    billingStatus,
  } = usePlano();
  const { profile, isAdmin, isSuperAdmin } = useAdmin();
  const { toast } = useToast();
  const [ciclo, setCiclo] = useState<"mensal" | "anual">("mensal");
  const [busy, setBusy] = useState<PlanId | null>(null);
  const [renewalAccepted, setRenewalAccepted] = useState(false);
  const [renewalBusy, setRenewalBusy] = useState(false);
  const [renewalRequestId, setRenewalRequestId] = useState<string | null>(null);

  const currentPlan: PlanId = plan;
  const canChange = !!(isAdmin || isSuperAdmin) && !setupRequired;

  const acao = (id: PlanId) => {
    if (id === currentPlan) return "atual";
    const atuais = PLAN_PACOTES[currentPlan];
    const destino = PLAN_PACOTES[id];
    if (atuais.every((pacote) => destino.includes(pacote))) return "upgrade";
    if (destino.every((pacote) => atuais.includes(pacote))) return "downgrade";
    return "troca";
  };

  const status = setupRequired
    ? { label: "Configuração inicial", className: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20" }
    : billingStatus === "pending"
      ? { label: "Aguardando ativação", className: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20" }
      : isBlocked
        ? { label: "Suspenso", className: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20" }
        : isExpired
          ? { label: "Expirado", className: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20" }
          : { label: "Ativo", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20" };

  const maxSaving = useMemo(
    () => Math.max(...PLAN_IDS.map((id) => economiaAnual(id))),
    []
  );

  const irParaPlanos = () => {
    const alvo = document.getElementById("lexis-plan-options");
    alvo?.scrollIntoView({ behavior: "smooth", block: "start" });
    toast({
      title: "Escolha o novo plano",
      description: "Selecione abaixo o plano desejado para registrar a alteração.",
    });
  };

  const onEscolher = async (id: PlanId) => {
    if (id === currentPlan || busy) return;

    if (setupRequired) {
      toast({
        title: "Empresa ainda não configurada",
        description: "Cadastre ou vincule a empresa antes de solicitar um plano.",
      });
      return;
    }

    if (!canChange) {
      toast({
        title: "Sem permissão",
        description: "Somente Administrador, Supervisor ou Superadmin pode solicitar mudança de plano.",
        variant: "destructive",
      });
      return;
    }

    setBusy(id);
    try {
      if (isSuperAdmin) {
        const empresaId = String(profile?.empresa_id || "").trim();
        if (!empresaId) {
          toast({
            title: "Selecione uma empresa",
            description: "Este Superadmin não está vinculado a uma empresa. Use o painel Superadmin para escolher o tenant que será alterado.",
            variant: "destructive",
          });
          return;
        }

        const r = await salvarPlanoEmpresaAction(empresaId, id);
        if (!r.ok || !r.persisted) {
          toast({
            title: "Não foi possível alterar o plano",
            description: r.error || "O banco não confirmou a alteração.",
            variant: "destructive",
          });
          return;
        }

        toast({
          title: "Plano alterado",
          description: PLAN_LABEL[currentPlan] + " → " + PLAN_LABEL[id] + ". A alteração foi gravada no banco.",
        });
        window.location.reload();
        return;
      }

      const r = await trocarMeuPlanoAction(id, ciclo);
      if (!r.ok) {
        toast({
          title: "Não foi possível solicitar",
          description: r.error || "Falha ao registrar a solicitação.",
          variant: "destructive",
        });
        return;
      }

      const tipo = acao(id);
      const pedido =
        tipo === "upgrade"
          ? "upgrade"
          : tipo === "downgrade"
            ? "downgrade"
            : "alteração de plano";

      const mensagem = [
        "Olá, registrei uma solicitação de " + pedido + " no LexisPredict.",
        "Plano atual: " + PLAN_LABEL[currentPlan] + ".",
        "Plano desejado: " + PLAN_LABEL[id] + ".",
        "Ciclo: " + ciclo + ".",
        profile?.email ? "Conta: " + profile.email + "." : "",
        "Empresa: " + (profile?.empresa_id || "tenant cadastrado") + ".",
        "Aguardo confirmação comercial para ativação.",
      ]
        .filter(Boolean)
        .join("\n");

      toast({
        title: "Solicitação registrada",
        description:
          "O plano atual permanece ativo até a aprovação comercial. Nenhum dado será migrado.",
      });

      window.open(
        "https://wa.me/5513991199349?text=" + encodeURIComponent(mensagem),
        "_blank",
        "noopener,noreferrer"
      );
    } finally {
      setBusy(null);
    }
  };




  const onSolicitarRenovacao = async () => {
    if (renewalBusy || !renewalAccepted || !canChange) return;
    setRenewalBusy(true);
    try {
      const result = await solicitarRenovacaoAssinaturaAction({
        ciclo,
        confirmouTermos: true,
        termosVersao: RENEWAL_TERMS_VERSION,
      });
      if (!result.ok) {
        toast({ title: "Renovação não registrada", description: result.error, variant: "destructive" });
        return;
      }
      setRenewalRequestId(result.requestId);
      setRenewalAccepted(false);
      toast({
        title: "Pedido de renovação registrado",
        description: "Aguardando confirmação comercial do valor, período e condições. Nenhuma cobrança foi realizada.",
      });
    } catch (error) {
      toast({
        title: "Falha ao solicitar renovação",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setRenewalBusy(false);
    }
  };

  return (
    <section aria-label="Planos e assinatura" className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-[#dfe7f2] bg-white shadow-[0_2px_10px_rgba(16,36,71,.035)]">
        <div className="grid gap-0 xl:grid-cols-[1.35fr_.75fr_.75fr_.75fr]">
          <div className="flex items-center gap-4 border-b border-[#e7edf5] p-5 xl:border-b-0 xl:border-r">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#eef5ff] text-[#1f6fff]">
              <Crown className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#526986]">Seu plano atual</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-black tracking-[-.03em] text-[#102447]">{PLAN_LABEL[currentPlan]}</h2>
                <Badge variant="outline" className={cn("rounded-full px-3 py-1 text-[10px] font-bold", status.className)}>
                  {status.label}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-[#6d7f9b]">{PLANOS_PRECOS[currentPlan].tagline}</p>
            </div>
          </div>

          <div className="border-b border-[#e7edf5] p-5 xl:border-b-0 xl:border-r">
            <p className="text-xs font-medium text-[#6d7f9b]">Próxima renovação</p>
            <p className="mt-1 text-lg font-black text-[#102447]">{expiresLabel || "Sem data"}</p>
            <p className="mt-1 text-xs text-[#6d7f9b]">{daysLeft === null ? "Validade não definida" : `Em ${Math.max(0, daysLeft)} dias`}</p>
          </div>

          <div className="border-b border-[#e7edf5] p-5 xl:border-b-0 xl:border-r">
            <p className="text-xs font-medium text-[#6d7f9b]">Status de cobrança</p>
            <p className="mt-1 text-lg font-black text-[#102447]">
              {billingStatus === "active" ? "Em dia" : status.label}
            </p>
            <p className="mt-1 text-xs text-[#6d7f9b]">Controle comercial do tenant</p>
          </div>

          <div className="p-5">
            <p className="text-xs font-medium text-[#6d7f9b]">Alteração de plano</p>
            <p className="mt-1 text-lg font-black text-emerald-600">Disponível</p>
            <p className="mt-1 text-xs text-[#6d7f9b]">Solicitação auditada e aprovada pelo comercial.</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h3 className="text-2xl font-black tracking-[-.03em] text-[#102447]">Escolha o plano ideal para sua equipe</h3>
          <p className="mt-1 text-sm text-[#6d7f9b]">Mesmo tenant, mais possibilidades. Os módulos liberados mudam conforme o plano.</p>
        </div>
        <div className="flex rounded-xl bg-[#edf2f8] p-1">
          <button
            type="button"
            onClick={() => { setCiclo("mensal"); setRenewalAccepted(false); }}
            className={cn(
              "min-w-[120px] rounded-lg px-5 py-2 text-sm font-bold transition",
              ciclo === "mensal" ? "bg-white text-[#1f6fff] shadow-sm" : "text-[#36516f]"
            )}
          >
            Mensal
          </button>
          <button
            type="button"
            onClick={() => { setCiclo("anual"); setRenewalAccepted(false); }}
            className={cn(
              "min-w-[120px] rounded-lg px-5 py-2 text-sm font-bold transition",
              ciclo === "anual" ? "bg-white text-[#1f6fff] shadow-sm" : "text-[#36516f]"
            )}
          >
            Anual <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] text-emerald-700">2 meses grátis</span>
          </button>
        </div>
      </div>

      <div id="lexis-plan-options" className="scroll-mt-24 grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {PLAN_IDS.map((id) => {
          const p = PLANOS_PRECOS[id];
          const meta = PLAN_STYLE[id];
          const Icon = meta.icon;
          const atual = id === currentPlan;
          const tipo = acao(id);
          const valor = ciclo === "mensal" ? p.valorMensal : p.valorAnual;
          const eq = mensalDoAnual(id);
          const eco = economiaAnual(id);

          return (
            <article
              key={id}
              className={cn(
                "relative flex min-h-[430px] flex-col rounded-2xl border bg-white p-5 shadow-[0_2px_10px_rgba(16,36,71,.035)]",
                atual ? "border-[#1f6fff] ring-1 ring-[#1f6fff]/20" : "border-[#dfe7f2]"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", meta.iconWrap)}>
                  <Icon className="h-5 w-5" />
                </div>
                {atual ? (
                  <span className="rounded-full bg-[#eaf2ff] px-3 py-1 text-[9px] font-black uppercase tracking-wider text-[#1f6fff]">
                    Plano atual
                  </span>
                ) : p.selo ? (
                  <span className="rounded-full bg-[#eef5ff] px-3 py-1 text-[9px] font-black uppercase tracking-wider text-[#1f6fff]">{p.selo}</span>
                ) : null}
              </div>

              <h4 className="mt-4 text-xl font-black text-[#102447]">{PLAN_LABEL[id]}</h4>
              <p className="mt-1 min-h-[42px] text-sm leading-relaxed text-[#607590]">{p.tagline}</p>

              <div className="mt-5">
                <div className="flex items-end gap-1">
                  <span className="text-[30px] font-black tracking-[-.04em] text-[#102447]">{formatBRL(valor)}</span>
                  <span className="pb-1 text-xs text-[#6d7f9b]">/{ciclo === "mensal" ? "mês" : "ano"}</span>
                </div>
                <p className="mt-1 text-xs text-[#6d7f9b]">
                  Anual: {formatBRL(p.valorAnual)} · {formatBRL(eq)}/mês equivalente
                </p>
                <p className="mt-1 text-xs font-bold text-emerald-600">Economia anual de {formatBRL(eco)}</p>
              </div>

              <div className="my-4 h-px bg-[#e8eef6]" />

              <ul className="flex-1 space-y-2.5">
                {p.beneficios.slice(0, 5).map((b) => (
                  <li key={b} className="flex gap-2 text-sm leading-snug text-[#27486f]">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                disabled={atual || !!busy || !canChange}
                onClick={() => void onEscolher(id)}
                className={cn(
                  "mt-5 flex h-11 w-full items-center justify-center rounded-xl border px-3 text-sm font-bold transition disabled:cursor-not-allowed",
                  atual
                    ? "border-[#a9c6ff] bg-[#dce9ff] text-[#165bce]"
                    : "border-[#1f6fff] bg-white text-[#1f6fff] hover:bg-[#eef5ff]",
                  !canChange && "opacity-55"
                )}
              >
                {busy === id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : atual ? (
                  <><Check className="mr-2 h-4 w-4" /> Plano atual</>
                ) : isSuperAdmin ? (
                  "Aplicar plano"
                ) : tipo === "upgrade" ? (
                  "Selecionar plano"
                ) : tipo === "downgrade" ? (
                  "Solicitar downgrade"
                ) : (
                  "Solicitar alteração"
                )}
              </button>
            </article>
          );
        })}
      </div>


      <section aria-labelledby="renovacao-assinatura-title" className="overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-[0_3px_14px_rgba(16,36,71,.07)]">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-violet-100 bg-gradient-to-r from-violet-50 via-white to-sky-50 p-5 sm:p-6">
          <div className="flex max-w-2xl items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
              <Clock3 className="h-5 w-5"/>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[.13em] text-violet-700">Assinatura da empresa</p>
              <h3 id="renovacao-assinatura-title" className="mt-1 text-xl font-black text-[#102447]">Termo de renovação de assinatura</h3>
              <p className="mt-1 text-sm leading-relaxed text-[#546987]">Confira o plano, o ciclo e as condições antes de enviar o pedido. A solicitação não renova automaticamente nem gera cobrança.</p>
            </div>
          </div>
          <Link href="/termos/renovacao-assinatura" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center rounded-xl border border-violet-300 bg-white px-4 py-2 text-xs font-bold text-violet-700 hover:bg-violet-50">
            Ler termo em página própria <ArrowRight className="ml-2 h-4 w-4"/>
          </Link>
        </div>
        <div className="space-y-4 p-5 sm:p-6">
          <div className="grid gap-3 rounded-xl border border-[#dfe7f2] bg-[#f8faff] p-4 sm:grid-cols-2">
            <div><p className="text-xs text-[#617693]">Plano cadastrado</p><p className="mt-1 text-base font-black text-[#102447]">{PLAN_LABEL[currentPlan]}</p></div>
            <div><p className="text-xs text-[#617693]">Validade atual</p><p className="mt-1 text-base font-black text-[#102447]">{expiresLabel || "Não informada"}</p></div>
            <div><p className="text-xs text-[#617693]">Novo ciclo solicitado</p><p className="mt-1 text-base font-black text-[#102447]">{ciclo === "anual" ? "12 meses" : "1 mês"}</p></div>
            <div><p className="text-xs text-[#617693]">Preço público de referência</p><p className="mt-1 text-base font-black text-[#102447]">{formatBRL(ciclo === "anual" ? PLANOS_PRECOS[currentPlan].valorAnual : PLANOS_PRECOS[currentPlan].valorMensal)}</p></div>
          </div>
          <details className="group rounded-xl border border-[#dfe7f2] bg-[#fbfcff] p-4">
            <summary className="cursor-pointer text-sm font-bold text-violet-700">Visualizar as condições completas do termo (versão {RENEWAL_TERMS_VERSION})</summary>
            <div className="mt-4 max-h-[370px] overflow-y-auto border-t border-[#e5e9f2] pt-4">
              <SubscriptionRenewalTermsContent
                planName={PLAN_LABEL[currentPlan]}
                cycle={ciclo}
                displayedAmount={formatBRL(ciclo === "anual" ? PLANOS_PRECOS[currentPlan].valorAnual : PLANOS_PRECOS[currentPlan].valorMensal)}
                expiresLabel={expiresLabel}
              />
            </div>
          </details>
          {renewalRequestId ? (
            <div role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
              <p className="font-bold">Solicitação registrada para análise comercial.</p>
              <p className="mt-1">Protocolo: <code className="break-all font-mono">{renewalRequestId}</code></p>
              <p className="mt-1 text-xs">A validade da assinatura e as cobranças não foram alteradas.</p>
            </div>
          ) : (
            <>
              <label className="flex items-start gap-3 rounded-xl border border-[#dfe7f2] p-4 text-sm leading-relaxed text-[#263955]">
                <input type="checkbox" checked={renewalAccepted} onChange={e=>setRenewalAccepted(e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-violet-600" disabled={!canChange || renewalBusy}/>
                <span>Li e compreendi o <strong>Termo de Renovação de Assinatura</strong> (versão {RENEWAL_TERMS_VERSION}). Confirmo que estou autorizado a solicitar a renovação pela empresa e entendo que o valor final e a ativação exigem confirmação comercial, sem débito automático por este pedido.</span>
              </label>
              <button type="button" onClick={() => void onSolicitarRenovacao()} disabled={!renewalAccepted || renewalBusy || !canChange} className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-violet-700 px-5 text-sm font-bold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto">
                {renewalBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ShieldCheck className="mr-2 h-4 w-4"/>}
                {renewalBusy ? "Registrando solicitação…" : "Solicitar renovação com aceite"}
              </button>
            </>
          )}
          <p className="text-xs text-[#667993]">Somente usuários autorizados podem enviar o pedido. Se já existir solicitação comercial pendente, ela será preservada; a renovação não a substituirá.</p>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex items-center gap-4 rounded-2xl border border-[#dfe7f2] bg-white p-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
            <MessageCircle className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-black text-[#102447]">Falar com o time comercial</p>
            <p className="mt-1 text-xs text-[#6d7f9b]">Tire dúvidas, receba uma proposta personalizada ou solicite um teste.</p>
          </div>
          <Button
            type="button"
            className="h-10 rounded-xl bg-emerald-600 px-4 text-white hover:bg-emerald-700"
            onClick={() => window.open("https://wa.me/5513991199349", "_blank", "noopener,noreferrer")}
          >
            <MessageCircle className="mr-2 h-4 w-4" /> Conversar no WhatsApp
          </Button>
        </div>

        <div className="flex items-center gap-4 rounded-2xl border border-[#dfe7f2] bg-white p-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#eef5ff] text-[#1f6fff]">
            <ArrowRight className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-black text-[#102447]">Precisa alterar seu plano?</p>
            <p className="mt-1 text-xs text-[#6d7f9b]">Solicite um upgrade ou downgrade. O plano atual segue ativo até a aprovação.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-xl border-[#1f6fff] px-4 text-[#1f6fff]"
            onClick={irParaPlanos}
          >
            Solicitar alteração
          </Button>
        </div>
      </div>

      {setupRequired || serverError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
          {serverError || "Conclua o cadastro da empresa para ativar um plano."}
        </div>
      ) : null}
    </section>
  );
}
