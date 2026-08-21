"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAdmin } from "@/hooks/use-admin";
import {
  PLAN_IDS,
  PLAN_LABEL,
  PLAN_BLURB,
  PLAN_PACOTES,
  type PlanId,
} from "@/lib/planos-pacotes";
import { planoDaEmpresa, savePlanoEmpresa } from "@/lib/planos-store";
import {
  listEmpresasParaPlanosAction,
  salvarPlanoEmpresaAction,
} from "@/app/actions/planos-actions";
import { PLANOS_PRECOS, PIX_RECEBEDOR, formatBRL } from "@/lib/planos-precos";
import { gerarPixCopiaCola, qrCodeUrl } from "@/lib/pix-emv";
import {
  criarPedido,
  confirmarPedidoPago,
  marcarPagamentoInformado,
  loadPedidos,
  statusLabel,
  type UpgradePedido,
} from "@/lib/upgrade-pedidos";
import {
  Check,
  Copy,
  Crown,
  Loader2,
  Sparkles,
  Zap,
  Building2,
  QrCode,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Ciclo = "mensal" | "anual";

export function PlanosEmpresaPanel() {
  const { isSuperAdmin, profile } = useAdmin();
  const { toast } = useToast();
  const [empresas, setEmpresas] = useState<{ id: string; nome: string }[]>([]);
  const [empresaId, setEmpresaId] = useState(profile?.empresa_id || "");
  const [planAtual, setPlanAtual] = useState<PlanId>("maximo");
  const [ciclo, setCiclo] = useState<Ciclo>("mensal");
  const [checkoutPlan, setCheckoutPlan] = useState<PlanId | null>(null);
  const [pedido, setPedido] = useState<UpgradePedido | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pedidos, setPedidos] = useState<UpgradePedido[]>([]);

  useEffect(() => {
    let live = true;
    (async () => {
      const rows = await listEmpresasParaPlanosAction().catch(() => []);
      if (!live) return;
      const list = rows.length
        ? rows
        : profile?.empresa_id
          ? [{ id: profile.empresa_id, nome: "Empresa atual" }]
          : [];
      setEmpresas(list);
      const id = list[0]?.id || profile?.empresa_id || "";
      setEmpresaId(id);
      setPlanAtual(planoDaEmpresa(id, "maximo"));
      setPedidos(loadPedidos().filter((p) => p.empresaId === id).slice(0, 5));
    })();
    return () => {
      live = false;
    };
  }, [profile?.empresa_id]);

  const empresaNome = empresas.find((e) => e.id === empresaId)?.nome || "Empresa";

  const pixData = useMemo(() => {
    if (!checkoutPlan) return null;
    const preco = PLANOS_PRECOS[checkoutPlan];
    const valor = ciclo === "mensal" ? preco.valorMensal : preco.valorAnual;
    const payload = gerarPixCopiaCola({
      chave: PIX_RECEBEDOR.chave,
      nomeRecebedor: PIX_RECEBEDOR.nome,
      cidade: PIX_RECEBEDOR.cidade,
      valor,
      txid: `LX${checkoutPlan.slice(0, 3)}${Date.now().toString(36)}`.slice(0, 25),
      descricao: `Lexis ${PLAN_LABEL[checkoutPlan]} ${ciclo}`,
    });
    return {
      valor,
      payload,
      qr: payload ? qrCodeUrl(payload, 260) : "",
    };
  }, [checkoutPlan, ciclo]);

  if (!isSuperAdmin) return null;

  const onPickEmpresa = (id: string) => {
    setEmpresaId(id);
    setPlanAtual(planoDaEmpresa(id, "maximo"));
    setCheckoutPlan(null);
    setPedido(null);
    setPedidos(loadPedidos().filter((p) => p.empresaId === id).slice(0, 5));
  };

  const iniciarCheckout = (plan: PlanId) => {
    setCheckoutPlan(plan);
    setPedido(null);
    setCopied(false);
  };

  const gerarPedidoPix = () => {
    if (!checkoutPlan || !pixData?.payload || !empresaId) return;
    const p = criarPedido({
      empresaId,
      empresaNome,
      plan: checkoutPlan,
      ciclo,
      valor: pixData.valor,
      pixPayload: pixData.payload,
    });
    setPedido(p);
    setPedidos(loadPedidos().filter((x) => x.empresaId === empresaId).slice(0, 5));
    toast({
      title: "Pix gerado",
      description: `Pague ${formatBRL(pixData.valor)}. Use a ref. do pedido no comprovante. Só Superadmin libera após ver o extrato.`,
    });
  };

  const copiarPix = async () => {
    const text = pedido?.pixPayload || pixData?.payload;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Pix copia e cola copiado" });
    } catch {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
  };

  /** Cliente: só avisa que pagou — NÃO libera plano. */
  const informarPagamento = () => {
    if (!pedido) {
      toast({
        title: "Gere o Pix antes",
        description: "Crie o pedido Pix para ter uma referência única no extrato.",
        variant: "destructive",
      });
      return;
    }
    const p = marcarPagamentoInformado(pedido.id);
    if (p) {
      setPedido(p);
      setPedidos(loadPedidos().filter((x) => x.empresaId === empresaId).slice(0, 8));
    }
    toast({
      title: "Pagamento informado",
      description: `Ref. ${pedido.ref}. O plano só libera quando o Superadmin confirmar o crédito no extrato (${PIX_RECEBEDOR.chave}).`,
    });
  };

  /** Superadmin: viu o Pix no extrato → libera de verdade. */
  const confirmarNoExtratoELiberar = async () => {
    if (!isSuperAdmin) {
      toast({
        title: "Sem permissão",
        description: "Só Superadmin confirma pagamento e libera plano.",
        variant: "destructive",
      });
      return;
    }
    if (!checkoutPlan || !empresaId) return;
    setConfirming(true);
    try {
      if (pedido) {
        confirmarPedidoPago(pedido.id, profile?.email || profile?.nome || "superadmin");
      }
      savePlanoEmpresa(empresaId, checkoutPlan);
      const res = await salvarPlanoEmpresaAction(empresaId, checkoutPlan);
      setPlanAtual(checkoutPlan);
      toast({
        title: `Plano ${PLAN_LABEL[checkoutPlan]} liberado`,
        description: res.persisted
          ? `${empresaNome} atualizada no banco. Ref. ${pedido?.ref || "—"}.`
          : "Salvo neste navegador. Confira migration empresas.plano.",
      });
      setCheckoutPlan(null);
      setPedido(null);
      setPedidos(loadPedidos().filter((x) => x.empresaId === empresaId).slice(0, 8));
    } catch (e: any) {
      toast({ title: "Falha ao liberar plano", description: e?.message, variant: "destructive" });
    } finally {
      setConfirming(false);
    }
  };

  /** Atalho admin: aplicar sem Pix (legado). */
  const aplicarDireto = async (plan: PlanId) => {
    if (!empresaId) return;
    setLoading(true);
    try {
      savePlanoEmpresa(empresaId, plan);
      await salvarPlanoEmpresaAction(empresaId, plan);
      setPlanAtual(plan);
      toast({ title: `Plano ${PLAN_LABEL[plan]} aplicado (admin)` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-3xl border border-border/60 bg-gradient-to-b from-card via-card to-background overflow-hidden shadow-sm">
      {/* Hero */}
      <div className="relative px-5 sm:px-8 pt-7 pb-6 border-b border-border/40 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/15 via-transparent to-transparent">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-black text-white px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em]">
              <Sparkles size={12} className="text-primary" />
              Upgrade comercial
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
              Pacotes por empresa
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Gere o <strong className="text-foreground">Pix</strong> com valor e referência.
              A liberação do plano é <strong className="text-foreground">manual</strong>: só após
              crédito no extrato (Superadmin). Não basta clicar em “já paguei”.
            </p>
          </div>
          <div className="flex flex-col items-stretch sm:items-end gap-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Building2 size={12} />
              Empresa
            </label>
            <select
              className="h-11 min-w-[220px] rounded-xl border border-border bg-background px-3 text-xs font-bold text-foreground shadow-sm"
              value={empresaId}
              onChange={(e) => onPickEmpresa(e.target.value)}
            >
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
            <Badge variant="outline" className="w-fit text-[10px] font-black uppercase">
              Plano atual: {PLAN_LABEL[planAtual]}
            </Badge>
          </div>
        </div>

        {/* Toggle ciclo */}
        <div className="mt-5 inline-flex rounded-full border border-border/60 bg-background/80 p-1">
          {(["mensal", "anual"] as Ciclo[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setCiclo(c);
                setPedido(null);
              }}
              className={cn(
                "px-4 h-9 rounded-full text-[10px] font-black uppercase tracking-wider transition",
                ciclo === c ? "bg-black text-white shadow" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {c === "mensal" ? "Mensal" : "Anual (−2 meses)"}
            </button>
          ))}
        </div>
      </div>

      {/* Cards de plano */}
      <div className="p-5 sm:p-8 grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        {PLAN_IDS.map((id) => {
          const preco = PLANOS_PRECOS[id];
          const valor = ciclo === "mensal" ? preco.valorMensal : preco.valorAnual;
          const ativo = planAtual === id;
          const selecionado = checkoutPlan === id;
          return (
            <div
              key={id}
              className={cn(
                "relative flex flex-col rounded-2xl border p-5 transition-all bg-card/80",
                preco.destaque && "ring-2 ring-primary/40 shadow-lg shadow-primary/5",
                selecionado && "border-primary bg-primary/5",
                ativo && !selecionado && "border-emerald-500/40"
              )}
            >
              {preco.destaque && (
                <span className="absolute -top-2.5 left-4 inline-flex items-center gap-1 rounded-full bg-primary text-black px-2 py-0.5 text-[9px] font-black uppercase tracking-wider">
                  <Zap size={10} /> Popular
                </span>
              )}
              {ativo && (
                <span className="absolute -top-2.5 right-4 inline-flex items-center gap-1 rounded-full bg-emerald-600 text-white px-2 py-0.5 text-[9px] font-black uppercase">
                  <Check size={10} /> Atual
                </span>
              )}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wide flex items-center gap-1.5">
                    {id === "maximo" && <Crown size={14} className="text-primary" />}
                    {PLAN_LABEL[id]}
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{PLAN_BLURB[id]}</p>
                </div>
              </div>
              <div className="mb-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black tabular-nums tracking-tight">{formatBRL(valor)}</span>
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">
                    /{ciclo === "mensal" ? "mês" : "ano"}
                  </span>
                </div>
                {ciclo === "anual" && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    equiv. {formatBRL(Math.round(preco.valorAnual / 12))}/mês
                  </p>
                )}
              </div>
              <ul className="space-y-1.5 mb-5 flex-1">
                {preco.beneficios.map((b) => (
                  <li key={b} className="flex gap-2 text-[11px] text-muted-foreground leading-snug">
                    <Check size={14} className="shrink-0 text-primary mt-0.5" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
                {PLAN_PACOTES[id].join(" · ")}
              </p>
              <Button
                type="button"
                className={cn(
                  "w-full h-11 rounded-xl font-black uppercase text-[10px] tracking-widest",
                  selecionado
                    ? "bg-primary text-black hover:bg-primary/90"
                    : "bg-black text-white hover:bg-primary hover:text-black"
                )}
                onClick={() => iniciarCheckout(id)}
              >
                {preco.cta}
              </Button>
              {isSuperAdmin && (
                <button
                  type="button"
                  className="mt-2 text-[9px] font-bold uppercase text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                  onClick={() => aplicarDireto(id)}
                  disabled={loading}
                >
                  Aplicar sem Pix (só Superadmin) (admin)
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Checkout Pix */}
      {checkoutPlan && pixData && (
        <div className="mx-5 sm:mx-8 mb-8 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:p-6">
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2">
                <QrCode className="text-primary" size={20} />
                <h3 className="text-sm font-black uppercase tracking-widest">
                  Checkout · {PLAN_LABEL[checkoutPlan]}
                </h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Empresa <strong className="text-foreground">{empresaNome}</strong> · ciclo{" "}
                <strong className="text-foreground">{ciclo}</strong>
              </p>
              <p className="text-3xl font-black tabular-nums tracking-tight">{formatBRL(pixData.valor)}</p>
              <div className="rounded-xl bg-secondary/40 border border-border/50 p-3 text-[11px] space-y-1">
                <p>
                  <span className="text-muted-foreground">Chave Pix</span>
                  <br />
                  <strong className="font-mono text-sm tracking-wide">{PIX_RECEBEDOR.chave}</strong>
                </p>
                <p className="text-muted-foreground">
                  Recebedor: {PIX_RECEBEDOR.nome} · {PIX_RECEBEDOR.cidade}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="h-11 rounded-xl bg-black text-white font-black uppercase text-[10px] tracking-widest"
                  onClick={gerarPedidoPix}
                >
                  Gerar Pix com valor
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-xl font-black uppercase text-[10px]"
                  onClick={copiarPix}
                  disabled={!pixData.payload}
                >
                  {copied ? <Check size={14} className="mr-1" /> : <Copy size={14} className="mr-1" />}
                  Copia e cola
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 rounded-xl text-[10px] font-bold uppercase"
                  onClick={() => {
                    setCheckoutPlan(null);
                    setPedido(null);
                  }}
                >
                  Fechar
                </Button>
              </div>
              <Button
                type="button"
                className="w-full sm:w-auto h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase text-[10px] tracking-widest gap-2"
                onClick={informarPagamento}
                disabled={confirming}
              >
                {confirming ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <ShieldCheck size={16} />
                )}
                Informei o pagamento (não libera sozinho)
              </Button>
              {isSuperAdmin && (
                <Button
                  type="button"
                  className="w-full h-11 font-black uppercase text-[10px] tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={confirming || !checkoutPlan}
                  onClick={confirmarNoExtratoELiberar}
                >
                  {confirming ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                  Superadmin: confirmar no extrato e liberar
                </Button>
              )}

              <p className="text-[10px] text-muted-foreground leading-snug max-w-md">
                “Informei o pagamento” só registra o pedido. O plano só muda depois que o
                Superadmin confirmar o valor no extrato da chave {PIX_RECEBEDOR.chave}.
              </p>
            </div>

            <div className="shrink-0 mx-auto lg:mx-0 text-center space-y-2">
              <div className="rounded-2xl border-2 border-border bg-white p-3 shadow-md inline-block">
                {pixData.qr ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={pixData.qr}
                    alt="QR Code Pix"
                    width={260}
                    height={260}
                    className="rounded-lg"
                  />
                ) : (
                  <div className="w-[260px] h-[260px] flex items-center justify-center text-xs text-muted-foreground">
                    Gere o Pix para ver o QR
                  </div>
                )}
              </div>
              <p className="text-[10px] font-bold uppercase text-muted-foreground">
                Escaneie no app do banco
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Últimos pedidos */}
      {pedidos.length > 0 && (
        <div className="px-5 sm:px-8 pb-8">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
            Pedidos recentes desta empresa
          </p>
          <ul className="space-y-1.5">
            {pedidos.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/50 px-3 py-2 text-[11px]"
              >
                <span className="font-bold">
                  {PLAN_LABEL[p.plan]} · {p.ciclo} · {formatBRL(p.valor)}
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[9px] uppercase font-black",
                    p.status === "pago_confirmado" && "border-emerald-500 text-emerald-700"
                  )}
                >
                  {p.status === "pago_confirmado" ? "Pago" : "Aguardando Pix"}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
