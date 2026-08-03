/**
 * Automação Judicial — consultas por tribunal + Portal de Custas TJSP (WebView).
 * CAPTCHA: sempre resolvido pelo operador. Sem robô / sem anti-captcha.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */
"use client";

import React, { useMemo, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  ExternalLink,
  Scale,
  Search,
  Receipt,
  Copy,
  Maximize2,
  Minimize2,
  X,
  AlertCircle,
} from "lucide-react";
import {
  TODOS_TRIBUNAIS,
  getConsultaUrlForCnj,
  getFallbacksForCnj,
  getTribunalByCnj,
  codigoJusticaFromCnj,
} from "@/lib/tribunais-links";
import { ConsultaTribunalButton } from "@/components/tribunal/consulta-tribunal-button";
import { AnimatedIcon } from "@/components/ui/animated-icon";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

/** Portal oficial de custas TJSP */
export const PORTAL_CUSTAS_TJSP =
  "https://portaldecustas.tjsp.jus.br/portaltjsp/pages/custas/new";

function onlyDigits(s: string) {
  return s.replace(/\D/g, "");
}

export default function AutomacaoJudicialPage() {
  const { toast } = useToast();
  const [cnj, setCnj] = useState("");
  const [q, setQ] = useState("");

  // Portal de Custas
  const [custasCnj, setCustasCnj] = useState("");
  const [custasCpf, setCustasCpf] = useState("");
  const [custasNome, setCustasNome] = useState("");
  const [showPortal, setShowPortal] = useState(false);
  const [portalExpanded, setPortalExpanded] = useState(true);
  const [iframeBlocked, setIframeBlocked] = useState(false);

  const resolved = useMemo(() => {
    if (!cnj.trim()) return null;
    return {
      code: codigoJusticaFromCnj(cnj),
      tribunal: getTribunalByCnj(cnj),
      url: getConsultaUrlForCnj(cnj),
      fallbacks: getFallbacksForCnj(cnj),
    };
  }, [cnj]);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return TODOS_TRIBUNAIS;
    return TODOS_TRIBUNAIS.filter(
      (t) =>
        t.sigla.toLowerCase().includes(term) ||
        t.nome.toLowerCase().includes(term) ||
        t.codigo.includes(term) ||
        t.sistema.includes(term)
    );
  }, [q]);

  const copyField = async (label: string, value: string) => {
    if (!value.trim()) {
      toast({ title: "Vazio", description: `Preencha ${label} antes.`, variant: "destructive" });
      return;
    }
    try {
      await navigator.clipboard.writeText(value.trim());
      toast({ title: "Copiado", description: `${label} na área de transferência.` });
    } catch {
      toast({ title: "Falha ao copiar", variant: "destructive" });
    }
  };

  const openPortalNovaAba = () => {
    window.open(PORTAL_CUSTAS_TJSP, "_blank", "noopener,noreferrer");
  };

  const abrirPortalNoApp = () => {
    setIframeBlocked(false);
    setShowPortal(true);
    setPortalExpanded(true);
    // Prefill clipboard helper: CNJ mais usado
    if (custasCnj.trim()) {
      navigator.clipboard?.writeText(custasCnj.trim()).catch(() => {});
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 border-b border-border/50 px-6 flex items-center gap-3 shrink-0">
          <AnimatedIcon icon={Scale} variant="glow" size={22} className="text-primary" />
          <div>
            <h1 className="text-sm font-black uppercase tracking-tight">Automação Judicial</h1>
            <p className="text-[9px] font-bold uppercase text-muted-foreground tracking-widest">
              Consulta · Portal de Custas TJSP
            </p>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-6">
          {/* ——— PORTAL DE CUSTAS TJSP ——— */}
          <section className="rounded-2xl border-2 border-amber-500/30 bg-card p-4 sm:p-6 space-y-4 max-w-3xl shadow-sm">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
                <Receipt className="text-amber-600" size={20} />
              </div>
              <div className="space-y-1">
                <h2 className="text-sm font-black uppercase tracking-tight">
                  Portal de Custas · TJSP
                </h2>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Abre o site oficial do tribunal dentro do app (ou em nova aba). Preencha os
                  dados abaixo para copiar rápido nos campos do portal. O{" "}
                  <strong>CAPTCHA</strong> é resolvido por você — não usamos robô nem serviço de
                  quebra de captcha.
                </p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[9px] font-black uppercase tracking-widest">
                  Nº do processo (CNJ)
                </Label>
                <div className="flex gap-1">
                  <Input
                    value={custasCnj}
                    onChange={(e) => setCustasCnj(e.target.value)}
                    placeholder="0000000-00.0000.8.26.0000"
                    className="h-11 rounded-xl font-mono text-xs"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-11 w-11 shrink-0 rounded-xl"
                    onClick={() => copyField("CNJ", custasCnj)}
                    title="Copiar CNJ"
                  >
                    <Copy size={14} />
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[9px] font-black uppercase tracking-widest">
                  CPF da parte
                </Label>
                <div className="flex gap-1">
                  <Input
                    value={custasCpf}
                    onChange={(e) => setCustasCpf(onlyDigits(e.target.value).slice(0, 11))}
                    placeholder="00000000000"
                    className="h-11 rounded-xl font-mono text-xs"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-11 w-11 shrink-0 rounded-xl"
                    onClick={() => copyField("CPF", custasCpf)}
                    title="Copiar CPF"
                  >
                    <Copy size={14} />
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-[9px] font-black uppercase tracking-widest">
                  Nome da parte (opcional)
                </Label>
                <div className="flex gap-1">
                  <Input
                    value={custasNome}
                    onChange={(e) => setCustasNome(e.target.value)}
                    placeholder="Nome completo"
                    className="h-11 rounded-xl text-xs"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-11 w-11 shrink-0 rounded-xl"
                    onClick={() => copyField("Nome", custasNome)}
                    title="Copiar nome"
                  >
                    <Copy size={14} />
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className="h-11 rounded-xl font-black uppercase text-[10px] tracking-widest gap-2"
                onClick={abrirPortalNoApp}
              >
                <Receipt size={16} />
                Abrir portal no app
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl font-black uppercase text-[10px] tracking-widest gap-2"
                onClick={openPortalNovaAba}
              >
                Nova aba <ExternalLink size={14} />
              </Button>
            </div>

            <div className="flex gap-2 items-start rounded-xl bg-secondary/40 p-3 text-[10px] text-muted-foreground leading-relaxed">
              <AlertCircle size={14} className="shrink-0 mt-0.5 text-amber-600" />
              <span>
                Fluxo: abrir portal → colar CNJ/CPF (botões copiar) → resolver CAPTCHA → gerar
                guia → baixar PDF no navegador. Se o tribunal bloquear iframe, use{" "}
                <strong>Nova aba</strong>.
              </span>
            </div>

            {/* WebView embutido */}
            {showPortal && (
              <div className="rounded-xl border border-border overflow-hidden bg-background">
                <div className="h-10 flex items-center justify-between px-2 border-b border-border/50 bg-secondary/30">
                  <span className="text-[10px] font-bold text-muted-foreground truncate px-2">
                    portaldecustas.tjsp.jus.br
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => setPortalExpanded((v) => !v)}
                    >
                      {portalExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={openPortalNovaAba}
                      title="Nova aba"
                    >
                      <ExternalLink size={14} />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => setShowPortal(false)}
                    >
                      <X size={14} />
                    </Button>
                  </div>
                </div>
                {portalExpanded && (
                  <div className="relative min-h-[480px] h-[55vh]">
                    <iframe
                      src={PORTAL_CUSTAS_TJSP}
                      title="Portal de Custas TJSP"
                      className="absolute inset-0 w-full h-full border-0 bg-white"
                      // sandbox: scripts necessários ao portal; sem top-navigation indevida
                      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
                      referrerPolicy="no-referrer-when-downgrade"
                      onLoad={() => {
                        // Se carregar em branco por X-Frame, usuário usa Nova aba
                      }}
                    />
                    {iframeBlocked && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/95 p-6 text-center">
                        <p className="text-sm font-bold">
                          O tribunal bloqueou a visualização embutida.
                        </p>
                        <Button onClick={openPortalNovaAba} className="rounded-xl font-black uppercase text-[10px]">
                          Abrir em nova aba
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ——— CNJ → tribunal ——— */}
          <section className="rounded-2xl border border-border/50 bg-card p-4 space-y-3 max-w-2xl">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Abrir consulta processual pelo CNJ
            </p>
            <div className="flex flex-wrap gap-2">
              <Input
                value={cnj}
                onChange={(e) => setCnj(e.target.value)}
                placeholder="0000000-00.0000.0.00.0000"
                className="h-11 rounded-xl font-mono text-sm max-w-md"
              />
              <ConsultaTribunalButton protocolo={cnj} label="Abrir tribunal" />
            </div>
            {resolved?.tribunal && (
              <p className="text-[11px] text-muted-foreground">
                {resolved.tribunal.sigla} · {resolved.tribunal.nome} ·{" "}
                <Badge variant="outline" className="text-[9px] uppercase">
                  {resolved.tribunal.sistema}
                </Badge>
              </p>
            )}
          </section>

          {/* ——— Lista tribunais ——— */}
          <section className="space-y-3">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Filtrar tribunal…"
                className="pl-10 h-11 rounded-xl"
              />
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {list.map((t) => (
                <div
                  key={t.codigo}
                  className="rounded-xl border border-border/40 bg-card p-4 space-y-2 hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-black text-sm">{t.sigla}</span>
                    <Badge variant="secondary" className="text-[8px] uppercase font-bold">
                      {t.sistema}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{t.nome}</p>
                  <p className="text-[10px] font-mono opacity-50">{t.codigo}</p>
                  <div className="flex flex-wrap gap-1 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-[9px] font-black uppercase rounded-lg gap-1"
                      onClick={() => window.open(t.url, "_blank", "noopener,noreferrer")}
                    >
                      Principal <ExternalLink size={12} />
                    </Button>
                    {(t.alternativos || []).map((a, i) => (
                      <Button
                        key={i}
                        size="sm"
                        variant="ghost"
                        className="h-8 text-[9px] font-bold uppercase rounded-lg"
                        onClick={() => window.open(a.url, "_blank", "noopener,noreferrer")}
                      >
                        {a.label || a.sistema}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
