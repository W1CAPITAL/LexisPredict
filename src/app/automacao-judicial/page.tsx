/**
 * AUTOMAÇÃO JUDICIAL — página real
 * Portal de Custas TJSP (WebView) + catálogo de tribunais
 * CAPTCHA = operador. Sem robô / sem 2Captcha.
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
  Link2,
} from "lucide-react";
import {
  TODOS_TRIBUNAIS,
  getConsultaUrlForCnj,
  getFallbacksForCnj,
  getTribunalByCnj,
  codigoJusticaFromCnj,
} from "@/lib/tribunais-links";
import { cn } from "@/lib/utils";

export const PORTAL_CUSTAS_TJSP =
  "https://portaldecustas.tjsp.jus.br/portaltjsp/pages/custas/new";

function onlyDigits(s: string) {
  return s.replace(/\D/g, "");
}

function copyText(value: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    return navigator.clipboard.writeText(value);
  }
  return Promise.reject();
}

/** Botão tribunal sem depender de dropdown-menu (evita build quebrado) */
function OpenTribunal({ protocolo }: { protocolo: string }) {
  const url = getConsultaUrlForCnj(protocolo);
  const t = getTribunalByCnj(protocolo);
  const fb = getFallbacksForCnj(protocolo);
  if (!url) return null;
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        className="h-11 rounded-xl font-black uppercase text-[10px] gap-2"
        onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
      >
        {t?.sigla || "Tribunal"} ({t?.sistema}) <ExternalLink size={14} />
      </Button>
      {fb.map((a, i) => (
        <Button
          key={i}
          type="button"
          variant="outline"
          className="h-11 rounded-xl font-bold uppercase text-[10px]"
          onClick={() => window.open(a.url, "_blank", "noopener,noreferrer")}
        >
          {a.label || a.sistema}
        </Button>
      ))}
    </div>
  );
}

export default function AutomacaoJudicialPage() {
  const [cnj, setCnj] = useState("");
  const [q, setQ] = useState("");
  const [custasCnj, setCustasCnj] = useState("");
  const [custasCpf, setCustasCpf] = useState("");
  const [custasNome, setCustasNome] = useState("");
  const [showPortal, setShowPortal] = useState(false);
  const [portalExpanded, setPortalExpanded] = useState(true);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const flash = (m: string) => {
    setToastMsg(m);
    setTimeout(() => setToastMsg(null), 2200);
  };

  const doCopy = async (label: string, value: string) => {
    if (!value.trim()) {
      flash(`${label} vazio`);
      return;
    }
    try {
      await copyText(value.trim());
      flash(`${label} copiado`);
    } catch {
      flash("Falha ao copiar");
    }
  };

  const resolved = useMemo(() => {
    if (!cnj.trim()) return null;
    return {
      code: codigoJusticaFromCnj(cnj),
      tribunal: getTribunalByCnj(cnj),
      url: getConsultaUrlForCnj(cnj),
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

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 border-b border-border/50 px-4 sm:px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
              <Scale className="text-primary" size={18} />
            </div>
            <div>
              <h1 className="text-sm font-black uppercase tracking-tight">
                Automação Judicial
              </h1>
              <p className="text-[9px] font-bold uppercase text-muted-foreground tracking-widest">
                Portal de Custas TJSP · Consultas
              </p>
            </div>
          </div>
          {toastMsg && (
            <Badge className="bg-emerald-600 text-white text-[10px] font-bold">
              {toastMsg}
            </Badge>
          )}
        </header>

        <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-6">
          {/* ===== PORTAL DE CUSTAS — BLOCO PRINCIPAL ===== */}
          <section className="rounded-2xl border-2 border-amber-500/40 bg-card p-4 sm:p-6 space-y-4 max-w-4xl shadow-md">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                <Receipt className="text-amber-700" size={22} />
              </div>
              <div>
                <h2 className="text-base font-black uppercase tracking-tight">
                  Portal de Custas · TJSP
                </h2>
                <p className="text-[12px] text-muted-foreground leading-relaxed mt-1">
                  Site oficial embutido no app. Preencha CNJ/CPF abaixo, use{" "}
                  <strong>Copiar</strong> e cole no portal. O{" "}
                  <strong>CAPTCHA</strong> é resolvido por você (sem robô).
                </p>
                <a
                  href={PORTAL_CUSTAS_TJSP}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-primary mt-1 hover:underline"
                >
                  <Link2 size={12} /> {PORTAL_CUSTAS_TJSP}
                </a>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[9px] font-black uppercase tracking-widest">
                  Nº processo (CNJ)
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
                    variant="outline"
                    className="h-11 px-3 rounded-xl shrink-0"
                    onClick={() => doCopy("CNJ", custasCnj)}
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
                    onChange={(e) =>
                      setCustasCpf(onlyDigits(e.target.value).slice(0, 11))
                    }
                    placeholder="00000000000"
                    className="h-11 rounded-xl font-mono text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 px-3 rounded-xl shrink-0"
                    onClick={() => doCopy("CPF", custasCpf)}
                  >
                    <Copy size={14} />
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-[9px] font-black uppercase tracking-widest">
                  Nome da parte
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
                    variant="outline"
                    className="h-11 px-3 rounded-xl shrink-0"
                    onClick={() => doCopy("Nome", custasNome)}
                  >
                    <Copy size={14} />
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className="h-12 rounded-xl font-black uppercase text-[11px] tracking-widest gap-2 bg-amber-600 hover:bg-amber-700 text-white"
                onClick={() => {
                  setShowPortal(true);
                  setPortalExpanded(true);
                  if (custasCnj.trim()) {
                    doCopy("CNJ", custasCnj);
                  }
                }}
              >
                <Receipt size={18} />
                Abrir Portal de Custas no app
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-12 rounded-xl font-black uppercase text-[11px] gap-2"
                onClick={() =>
                  window.open(PORTAL_CUSTAS_TJSP, "_blank", "noopener,noreferrer")
                }
              >
                Abrir em nova aba <ExternalLink size={14} />
              </Button>
            </div>

            <div className="flex gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-[11px] leading-relaxed text-muted-foreground">
              <AlertCircle size={16} className="text-amber-700 shrink-0 mt-0.5" />
              <span>
                Fluxo: 1) Abrir portal 2) Colar CNJ/CPF 3) Resolver CAPTCHA 4)
                Gerar guia 5) Baixar PDF no navegador. Se a tela ficar em branco,
                o TJSP bloqueou iframe — use <strong>nova aba</strong>.
              </span>
            </div>

            {showPortal && (
              <div className="rounded-xl border-2 border-border overflow-hidden bg-white">
                <div className="h-11 flex items-center justify-between px-2 bg-secondary/50 border-b">
                  <span className="text-[10px] font-bold truncate px-2">
                    portaldecustas.tjsp.jus.br
                  </span>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => setPortalExpanded((v) => !v)}
                    >
                      {portalExpanded ? (
                        <Minimize2 size={14} />
                      ) : (
                        <Maximize2 size={14} />
                      )}
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() =>
                        window.open(
                          PORTAL_CUSTAS_TJSP,
                          "_blank",
                          "noopener,noreferrer"
                        )
                      }
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
                  <iframe
                    src={PORTAL_CUSTAS_TJSP}
                    title="Portal de Custas TJSP"
                    className="w-full border-0 bg-white"
                    style={{ height: "min(70vh, 720px)", minHeight: 480 }}
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                )}
              </div>
            )}
          </section>

          {/* ===== Consulta por CNJ ===== */}
          <section className="rounded-2xl border border-border/50 bg-card p-4 space-y-3 max-w-2xl">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Abrir consulta processual (eproc / e-SAJ / PJe)
            </p>
            <Input
              value={cnj}
              onChange={(e) => setCnj(e.target.value)}
              placeholder="0000000-00.0000.0.00.0000"
              className="h-11 rounded-xl font-mono text-sm max-w-md"
            />
            <OpenTribunal protocolo={cnj} />
            {resolved?.tribunal && (
              <p className="text-[11px] text-muted-foreground">
                {resolved.tribunal.sigla} · {resolved.tribunal.nome} ·{" "}
                <Badge variant="outline" className="text-[9px] uppercase">
                  {resolved.tribunal.sistema}
                </Badge>
              </p>
            )}
          </section>

          {/* ===== Lista ===== */}
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
                  className="rounded-xl border border-border/40 bg-card p-4 space-y-2"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-black text-sm">{t.sigla}</span>
                    <Badge variant="secondary" className="text-[8px] uppercase">
                      {t.sistema}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{t.nome}</p>
                  <p className="text-[10px] font-mono opacity-50">{t.codigo}</p>
                  <div className="flex flex-wrap gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-[9px] font-black uppercase rounded-lg gap-1"
                      onClick={() =>
                        window.open(t.url, "_blank", "noopener,noreferrer")
                      }
                    >
                      Abrir <ExternalLink size={12} />
                    </Button>
                    {(t.alternativos || []).map((a, i) => (
                      <Button
                        key={i}
                        size="sm"
                        variant="ghost"
                        className="h-8 text-[9px] font-bold uppercase"
                        onClick={() =>
                          window.open(a.url, "_blank", "noopener,noreferrer")
                        }
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
