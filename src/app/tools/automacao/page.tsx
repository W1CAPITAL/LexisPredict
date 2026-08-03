/**
 * Automação Judicial — rota REAL do menu: /tools/automacao
 * Portal de Custas TJSP (WebView) + e-SAJ enrich + captura + guia
 * CAPTCHA = operador. Sem robô / sem 2Captcha.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */
"use client";

import React, { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Camera,
  Search,
  ExternalLink,
  Scale,
  Receipt,
  Copy,
  Maximize2,
  Minimize2,
  X,
  AlertCircle,
  Link2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  enrichWithEsaJAction,
  getGuiaJudicialAction,
  getConsultaUrlAction,
} from "@/app/actions/esa-j-actions";

/** URL oficial Portal de Custas TJSP */
export const PORTAL_CUSTAS_TJSP =
  "https://portaldecustas.tjsp.jus.br/portaltjsp/pages/custas/new";

function onlyDigits(s: string) {
  return s.replace(/\D/g, "");
}

export default function AutomacaoJudicialPage() {
  const [cnj, setCnj] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [resultado, setResultado] = useState<any>(null);
  const { toast } = useToast();

  // Portal de Custas
  const [custasCnj, setCustasCnj] = useState("");
  const [custasCpf, setCustasCpf] = useState("");
  const [custasNome, setCustasNome] = useState("");
  const [showPortal, setShowPortal] = useState(false);
  const [portalExpanded, setPortalExpanded] = useState(true);

  const cleanCnj = cnj.replace(/\D/g, "");

  const doCopy = async (label: string, value: string) => {
    if (!value.trim()) {
      toast({ title: `${label} vazio`, variant: "destructive" });
      return;
    }
    try {
      await navigator.clipboard.writeText(value.trim());
      toast({ title: `${label} copiado` });
    } catch {
      toast({ title: "Falha ao copiar", variant: "destructive" });
    }
  };

  const handleEnrich = async () => {
    if (cleanCnj.length !== 20) {
      toast({ title: "CNJ inválido", variant: "destructive" });
      return;
    }
    setLoading("enrich");
    try {
      const res = await enrichWithEsaJAction(cnj);
      setResultado(res);
      toast({
        title: res.success
          ? "Dados enriquecidos com sucesso"
          : "Tribunal não é e-SAJ ou falhou",
      });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  const handleScreenshot = async () => {
    if (cleanCnj.length !== 20) {
      toast({ title: "CNJ inválido", variant: "destructive" });
      return;
    }
    setLoading("screenshot");
    try {
      const urlRes = await getConsultaUrlAction(cnj);
      if (!urlRes?.url) {
        toast({
          title: "URL de consulta não encontrada",
          variant: "destructive",
        });
        return;
      }
      window.open(urlRes.url, "_blank", "noopener,noreferrer");
      toast({
        title: "Página do tribunal aberta",
        description: "Capture a tela manualmente se precisar.",
      });
      setResultado((prev: any) => ({
        ...prev,
        screenshot: "Página do tribunal aberta em nova aba.",
      }));
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  const handleGuia = async () => {
    if (cleanCnj.length !== 20) {
      toast({ title: "CNJ inválido", variant: "destructive" });
      return;
    }
    setLoading("guia");
    try {
      const res = await getGuiaJudicialAction(cnj);
      setResultado((prev: any) => ({ ...prev, guia: res }));
      // Preferir portal oficial TJSP
      const url = res?.url || PORTAL_CUSTAS_TJSP;
      window.open(url, "_blank", "noopener,noreferrer");
      setCustasCnj(cnj);
      setShowPortal(true);
      setPortalExpanded(true);
      toast({
        title: "Portal de Custas",
        description: "Cole o CNJ e resolva o CAPTCHA no portal.",
      });
    } catch (e: any) {
      // Fallback direto ao portal oficial
      setCustasCnj(cnj);
      setShowPortal(true);
      window.open(PORTAL_CUSTAS_TJSP, "_blank", "noopener,noreferrer");
      toast({
        title: "Abrindo Portal de Custas TJSP",
        description: e?.message || "Use o portal embutido ou a nova aba.",
      });
    } finally {
      setLoading(null);
    }
  };

  const abrirPortalNoApp = () => {
    if (custasCnj.trim()) {
      doCopy("CNJ", custasCnj);
    } else if (cnj.trim()) {
      setCustasCnj(cnj);
      doCopy("CNJ", cnj);
    }
    setShowPortal(true);
    setPortalExpanded(true);
  };

  const grau =
    resultado?.data?.["Primeiro Grau"] || resultado?.data?.["Segundo Grau"];

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 p-4 md:p-8 max-w-6xl mx-auto space-y-6 overflow-auto">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Scale className="w-6 h-6 text-primary" />
            Automação Judicial
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Portal de Custas TJSP · e-SAJ · Captura · Guias
          </p>
        </div>

        {/* ========== PORTAL DE CUSTAS TJSP (OBRIGATÓRIO) ========== */}
        <Card className="border-2 border-amber-500/50 shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="text-amber-600" size={22} />
              Portal de Custas · TJSP
            </CardTitle>
            <CardDescription className="text-[12px] leading-relaxed">
              Site oficial embutido no app. Preencha os dados, use{" "}
              <strong>Copiar</strong>, cole no portal e resolva o{" "}
              <strong>CAPTCHA</strong> você mesmo (sem robô).
            </CardDescription>
            <a
              href={PORTAL_CUSTAS_TJSP}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline mt-1"
            >
              <Link2 size={12} /> {PORTAL_CUSTAS_TJSP}
            </a>
          </CardHeader>
          <CardContent className="space-y-4">
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
                onClick={abrirPortalNoApp}
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
                Nova aba <ExternalLink size={14} />
              </Button>
              {cnj.trim() && (
                <Button
                  type="button"
                  variant="secondary"
                  className="h-12 rounded-xl font-bold uppercase text-[10px]"
                  onClick={() => {
                    setCustasCnj(cnj);
                    toast({ title: "CNJ da consulta copiado para o portal" });
                  }}
                >
                  Usar CNJ da consulta abaixo
                </Button>
              )}
            </div>

            <div className="flex gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-[11px] leading-relaxed text-muted-foreground">
              <AlertCircle
                size={16}
                className="text-amber-700 shrink-0 mt-0.5"
              />
              <span>
                1) Abrir portal 2) Colar CNJ/CPF 3) CAPTCHA 4) Gerar guia 5)
                Baixar PDF. Se a tela ficar em branco, o TJSP bloqueou o iframe —
                use <strong>Nova aba</strong>.
              </span>
            </div>

            {showPortal && (
              <div className="rounded-xl border-2 border-border overflow-hidden bg-white">
                <div className="h-11 flex items-center justify-between px-2 bg-muted/50 border-b">
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
          </CardContent>
        </Card>

        {/* ========== Consulta CNJ / e-SAJ (existente) ========== */}
        <Card>
          <CardHeader>
            <CardTitle>Número do Processo (CNJ)</CardTitle>
            <CardDescription>
              Enriquecer e-SAJ, abrir página do tribunal ou emitir guia
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="1000972-17.2025.8.26.0538"
              value={cnj}
              onChange={(e) => setCnj(e.target.value)}
              className="text-lg font-mono h-12"
            />

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={handleEnrich}
                disabled={!!loading}
                className="gap-2"
              >
                {loading === "enrich" ? (
                  <Loader2 className="animate-spin h-4 w-4" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Enriquecer (e-SAJ)
              </Button>

              <Button
                onClick={handleScreenshot}
                disabled={!!loading}
                variant="secondary"
                className="gap-2"
              >
                {loading === "screenshot" ? (
                  <Loader2 className="animate-spin h-4 w-4" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
                Abrir página do tribunal
              </Button>

              <Button
                onClick={handleGuia}
                disabled={!!loading}
                variant="outline"
                className="gap-2 border-amber-500/50 text-amber-800"
              >
                {loading === "guia" ? (
                  <Loader2 className="animate-spin h-4 w-4" />
                ) : (
                  <Receipt className="h-4 w-4" />
                )}
                Guia de custas (portal)
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Resultados enrich */}
        {grau && (
          <div className="space-y-4">
            {grau.custasDetectadas && grau.custasDetectadas.length > 0 && (
              <Card className="border-amber-400">
                <CardHeader>
                  <CardTitle className="text-amber-700">
                    Movimentações com custas
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {grau.custasDetectadas.map((item: string, i: number) => (
                    <p key={i} className="text-sm">
                      {item}
                    </p>
                  ))}
                </CardContent>
              </Card>
            )}

            {grau.movimentações && grau.movimentações.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Últimas movimentações</CardTitle>
                  <CardDescription>
                    {grau.movimentações.length} no total
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {grau.movimentações.slice(0, 12).map((m: any, i: number) => (
                    <div
                      key={i}
                      className={`p-3 rounded-lg border text-sm ${
                        m.isCustas
                          ? "border-amber-400 bg-amber-50/50 dark:bg-amber-950/20"
                          : ""
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-xs text-muted-foreground">
                          {m.data}
                        </span>
                        {m.isCustas && (
                          <Badge
                            variant="outline"
                            className="text-amber-600 border-amber-400"
                          >
                            Custas
                          </Badge>
                        )}
                      </div>
                      <p className="leading-relaxed">{m.descricao}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {(resultado?.guia?.url || true) && (
              <div className="flex justify-center gap-2 flex-wrap">
                <Button
                  size="lg"
                  className="gap-2 bg-amber-600 hover:bg-amber-700"
                  onClick={abrirPortalNoApp}
                >
                  <Receipt className="h-4 w-4" />
                  Abrir Portal de Custas no app
                </Button>
                {resultado?.guia?.url && (
                  <Button asChild size="lg" variant="outline" className="gap-2">
                    <a
                      href={resultado.guia.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Link da guia
                    </a>
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {resultado && !resultado.success && !grau && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive">
                {resultado.note ||
                  "Não foi possível enriquecer este processo. Use o Portal de Custas acima."}
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
