/**
 * Automação Judicial — /tools/automacao
 * ABA PRINCIPAL: enriquecer / consultar em TODOS os tribunais (não só e-SAJ)
 * SUBABA: Portal de Custas TJSP (secundário)
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
  Building2,
  Gavel,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  enrichMultiTribunalAction,
  getMultiConsultaUrlAction,
} from "@/app/actions/multi-tribunal-actions";
import {
  TODOS_TRIBUNAIS,
  getTribunalByCnj,
} from "@/lib/tribunais-links";
import { cn } from "@/lib/utils";

export const PORTAL_CUSTAS_TJSP =
  "https://portaldecustas.tjsp.jus.br/portaltjsp/pages/custas/new";

type TabId = "consulta" | "custas";

function onlyDigits(s: string) {
  return s.replace(/\D/g, "");
}

export default function AutomacaoJudicialPage() {
  const [tab, setTab] = useState<TabId>("consulta");
  const [cnj, setCnj] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [resultado, setResultado] = useState<any>(null);
  const { toast } = useToast();

  // Custas (subaba)
  const [custasCnj, setCustasCnj] = useState("");
  const [custasCpf, setCustasCpf] = useState("");
  const [custasNome, setCustasNome] = useState("");
  const [showPortal, setShowPortal] = useState(false);
  const [portalExpanded, setPortalExpanded] = useState(true);

  const cleanCnj = cnj.replace(/\D/g, "");
  const tribunalPreview = cnj.trim() ? getTribunalByCnj(cnj) : null;

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

  /** Enriquecer = mesmo fluxo do e-SAJ, para qualquer tribunal */
  const handleEnrich = async () => {
    if (cleanCnj.length !== 20) {
      toast({ title: "CNJ inválido", variant: "destructive" });
      return;
    }
    setLoading("enrich");
    try {
      const res = await enrichMultiTribunalAction(cnj);
      setResultado(res);
      if (res.success) {
        toast({
          title: res.multi
            ? `${res.multi.tribunal} · ${res.multi.sistema}`
            : "Consulta resolvida",
          description: res.note || "Dados disponíveis abaixo.",
        });
      } else {
        toast({
          title: "Falha",
          description: res.error || "Não foi possível enriquecer.",
          variant: "destructive",
        });
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  const handleOpenConsulta = async () => {
    if (cleanCnj.length !== 20) {
      toast({ title: "CNJ inválido", variant: "destructive" });
      return;
    }
    setLoading("open");
    try {
      const res = await getMultiConsultaUrlAction(cnj);
      if (res.url) {
        window.open(res.url, "_blank", "noopener,noreferrer");
        toast({
          title: `Abrindo ${res.tribunal || "tribunal"}`,
          description: res.sistema || "",
        });
      } else {
        toast({ title: "URL não encontrada", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  const grau =
    resultado?.data?.["Primeiro Grau"] ||
    resultado?.data?.["Segundo Grau"] ||
    null;

  const multi = resultado?.multi;

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
            Consulta e enriquecimento em todos os tribunais · Custas em subaba
          </p>
        </div>

        {/* ——— Subnavegação ——— */}
        <div className="flex gap-2 border-b border-border pb-0">
          <button
            type="button"
            onClick={() => setTab("consulta")}
            className={cn(
              "px-4 py-2.5 text-[11px] font-black uppercase tracking-widest rounded-t-xl border border-b-0 transition-colors",
              tab === "consulta"
                ? "bg-card text-foreground border-border"
                : "bg-transparent text-muted-foreground border-transparent hover:text-foreground"
            )}
          >
            <span className="inline-flex items-center gap-2">
              <Building2 size={14} />
              Consulta multi-tribunal
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTab("custas")}
            className={cn(
              "px-4 py-2.5 text-[11px] font-black uppercase tracking-widest rounded-t-xl border border-b-0 transition-colors",
              tab === "custas"
                ? "bg-card text-foreground border-border"
                : "bg-transparent text-muted-foreground border-transparent hover:text-foreground"
            )}
          >
            <span className="inline-flex items-center gap-2">
              <Receipt size={14} />
              Custas (TJSP)
            </span>
          </button>
        </div>

        {/* ===================== ABA PRINCIPAL ===================== */}
        {tab === "consulta" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gavel size={18} />
                  Enriquecer processo (todos os tribunais)
                </CardTitle>
                <CardDescription>
                  Mesmo fluxo do “Enriquecer e-SAJ”: identifica o tribunal pelo
                  CNJ, tenta enrich automático na família e-SAJ e, nos demais,
                  prepara a consulta pública (eproc / PJe / Projudi).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="0000000-00.0000.0.00.0000"
                  value={cnj}
                  onChange={(e) => setCnj(e.target.value)}
                  className="text-lg font-mono h-12"
                />

                {tribunalPreview && (
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <Badge className="font-black uppercase">
                      {tribunalPreview.sigla}
                    </Badge>
                    <span className="text-muted-foreground">
                      {tribunalPreview.nome}
                    </span>
                    <Badge variant="outline" className="uppercase text-[9px]">
                      {tribunalPreview.sistema}
                    </Badge>
                    {tribunalPreview.esajFamily && (
                      <Badge
                        variant="secondary"
                        className="text-[9px] uppercase"
                      >
                        família e-SAJ
                      </Badge>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={handleEnrich}
                    disabled={!!loading}
                    className="gap-2 h-11 font-bold"
                  >
                    {loading === "enrich" ? (
                      <Loader2 className="animate-spin h-4 w-4" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    Enriquecer (multi-tribunal)
                  </Button>

                  <Button
                    onClick={handleOpenConsulta}
                    disabled={!!loading}
                    variant="secondary"
                    className="gap-2 h-11"
                  >
                    {loading === "open" ? (
                      <Loader2 className="animate-spin h-4 w-4" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                    Abrir consulta pública
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Resultado multi */}
            {multi && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {multi.tribunal} — {multi.nome}
                  </CardTitle>
                  <CardDescription>
                    Sistema: {multi.sistema} · modo: {multi.modo}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {resultado?.note && (
                    <p className="text-sm text-muted-foreground">
                      {resultado.note}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      className="gap-2"
                      onClick={() =>
                        window.open(
                          multi.url,
                          "_blank",
                          "noopener,noreferrer"
                        )
                      }
                    >
                      Abrir {multi.tribunal} <ExternalLink size={14} />
                    </Button>
                    {(multi.fallbacks || []).map((f: any, i: number) => (
                      <Button
                        key={i}
                        variant="outline"
                        onClick={() =>
                          window.open(f.url, "_blank", "noopener,noreferrer")
                        }
                      >
                        {f.label || f.sistema}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Dados e-SAJ se vieram do enrich */}
            {grau && (
              <div className="space-y-4">
                {grau.movimentações && grau.movimentações.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Movimentações</CardTitle>
                      <CardDescription>
                        {grau.movimentações.length} encontradas
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {grau.movimentações
                        .slice(0, 15)
                        .map((m: any, i: number) => (
                          <div
                            key={i}
                            className="p-3 rounded-lg border text-sm"
                          >
                            <span className="text-xs text-muted-foreground font-medium">
                              {m.data}
                            </span>
                            <p className="leading-relaxed mt-1">
                              {m.descricao}
                            </p>
                          </div>
                        ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Lista rápida de tribunais */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Tribunais mapeados</CardTitle>
                <CardDescription>
                  Clique para abrir a consulta pública padrão
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-auto">
                  {TODOS_TRIBUNAIS.map((t) => (
                    <button
                      key={t.codigo}
                      type="button"
                      className="text-left p-3 rounded-xl border hover:border-primary/40 transition-colors"
                      onClick={() =>
                        window.open(t.url, "_blank", "noopener,noreferrer")
                      }
                    >
                      <div className="flex justify-between items-center gap-2">
                        <span className="font-black text-sm">{t.sigla}</span>
                        <Badge
                          variant="secondary"
                          className="text-[8px] uppercase"
                        >
                          {t.sistema}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {t.nome}
                      </p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ===================== SUBABA CUSTAS ===================== */}
        {tab === "custas" && (
          <Card className="border border-amber-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Receipt className="text-amber-600" size={20} />
                Portal de Custas · TJSP
              </CardTitle>
              <CardDescription className="text-[12px]">
                Subaba auxiliar. CAPTCHA manual. Sem robô.
              </CardDescription>
              <a
                href={PORTAL_CUSTAS_TJSP}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
              >
                <Link2 size={12} /> {PORTAL_CUSTAS_TJSP}
              </a>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[9px] font-black uppercase">CNJ</Label>
                  <div className="flex gap-1">
                    <Input
                      value={custasCnj}
                      onChange={(e) => setCustasCnj(e.target.value)}
                      placeholder="0000000-00.0000.8.26.0000"
                      className="h-11 font-mono text-xs"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 px-3"
                      onClick={() => doCopy("CNJ", custasCnj)}
                    >
                      <Copy size={14} />
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[9px] font-black uppercase">CPF</Label>
                  <div className="flex gap-1">
                    <Input
                      value={custasCpf}
                      onChange={(e) =>
                        setCustasCpf(onlyDigits(e.target.value).slice(0, 11))
                      }
                      placeholder="00000000000"
                      className="h-11 font-mono text-xs"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 px-3"
                      onClick={() => doCopy("CPF", custasCpf)}
                    >
                      <Copy size={14} />
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-[9px] font-black uppercase">Nome</Label>
                  <div className="flex gap-1">
                    <Input
                      value={custasNome}
                      onChange={(e) => setCustasNome(e.target.value)}
                      className="h-11 text-xs"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 px-3"
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
                  className="h-11 gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold uppercase text-[10px]"
                  onClick={() => {
                    if (custasCnj.trim()) doCopy("CNJ", custasCnj);
                    setShowPortal(true);
                    setPortalExpanded(true);
                  }}
                >
                  <Receipt size={16} /> Abrir portal no app
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 gap-2 font-bold uppercase text-[10px]"
                  onClick={() =>
                    window.open(
                      PORTAL_CUSTAS_TJSP,
                      "_blank",
                      "noopener,noreferrer"
                    )
                  }
                >
                  Nova aba <ExternalLink size={14} />
                </Button>
              </div>

              <div className="flex gap-2 text-[11px] text-muted-foreground bg-muted/40 p-3 rounded-xl">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                Cole CNJ/CPF no portal, resolva o CAPTCHA e baixe a guia. Se o
                iframe falhar, use nova aba.
              </div>

              {showPortal && (
                <div className="rounded-xl border overflow-hidden bg-white">
                  <div className="h-10 flex items-center justify-between px-2 bg-muted/50 border-b">
                    <span className="text-[10px] font-bold px-2">
                      portaldecustas.tjsp.jus.br
                    </span>
                    <div className="flex gap-1">
                      <Button
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
                      className="w-full border-0"
                      style={{ height: "min(65vh, 640px)", minHeight: 420 }}
                      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
