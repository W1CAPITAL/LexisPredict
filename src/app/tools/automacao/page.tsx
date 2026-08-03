"use client";

import React, { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Camera,
  FileText,
  Search,
  ExternalLink,
  Scale,
  AlertTriangle,
  Users,
  Gavel,
  Calendar,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  enrichWithEsaJAction,
  getGuiaJudicialAction,
  getConsultaUrlAction,
} from "@/app/actions/esa-j-actions";

export default function AutomacaoJudicialPage() {
  const [cnj, setCnj] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [resultado, setResultado] = useState<any>(null);
  const { toast } = useToast();

  const cleanCnj = cnj.replace(/\D/g, "");

  // ====================== ENRIQUECER (e-SAJ) ======================
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
        title: res.success ? "Dados enriquecidos com sucesso" : "Tribunal não é e-SAJ",
      });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  // ====================== CAPTURA DE TELA (versão estável) ======================
  const handleScreenshot = async () => {
    if (cleanCnj.length !== 20) {
      toast({ title: "CNJ inválido", variant: "destructive" });
      return;
    }

    setLoading("screenshot");
    try {
      const urlRes = await getConsultaUrlAction(cnj);

      if (!urlRes?.url) {
        toast({ title: "URL de consulta não encontrada", variant: "destructive" });
        return;
      }

      // Abre a página oficial do tribunal em nova aba
      window.open(urlRes.url, "_blank");

      toast({
        title: "Página do tribunal aberta",
        description: "Tire a captura de tela manualmente (Ctrl + Shift + S ou ferramenta do navegador).",
      });

      setResultado((prev: any) => ({
        ...prev,
        screenshot: "Página do tribunal aberta. Tire a captura manualmente (limitação da Vercel).",
      }));
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  // ====================== GUIA JUDICIAL ======================
  const handleGuia = async () => {
    if (cleanCnj.length !== 20) {
      toast({ title: "CNJ inválido", variant: "destructive" });
      return;
    }
    setLoading("guia");
    try {
      const res = await getGuiaJudicialAction(cnj);
      setResultado((prev: any) => ({ ...prev, guia: res }));
      if (res?.url) window.open(res.url, "_blank");
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  const grau = resultado?.data?.["Primeiro Grau"] || resultado?.data?.["Segundo Grau"];

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 p-6 md:p-10 max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Scale className="w-6 h-6 text-primary" />
            Automação Judicial
          </h1>
          <p className="text-muted-foreground mt-1">
            Enriquecimento e-SAJ • Captura de tela • Guias de custas
          </p>
        </div>

        {/* Input + Botões */}
        <Card>
          <CardHeader>
            <CardTitle>Número do Processo (CNJ)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="1000972-17.2025.8.26.0538"
              value={cnj}
              onChange={(e) => setCnj(e.target.value)}
              className="text-lg font-mono h-12"
            />

            <div className="flex flex-wrap gap-3">
              <Button onClick={handleEnrich} disabled={!!loading} className="gap-2">
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
                Abrir Página + Captura Manual
              </Button>

              <Button
                onClick={handleGuia}
                disabled={!!loading}
                variant="outline"
                className="gap-2"
              >
                {loading === "guia" ? (
                  <Loader2 className="animate-spin h-4 w-4" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                Emitir / Abrir Guia
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ====================== RESULTADO FORMATADO ====================== */}
        {resultado?.success && grau && (
          <div className="space-y-6">
            {/* Resumo */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{grau.classe || "Processo"}</span>
                  <Badge variant="secondary">{grau.area}</Badge>
                </CardTitle>
                <CardDescription>{resultado.data.id}</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Distribuição</p>
                    <p className="font-medium">{grau.data || "—"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Gavel className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Juiz</p>
                    <p className="font-medium">{grau.juiz || "—"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground font-bold">R$</span>
                  <div>
                    <p className="text-xs text-muted-foreground">Valor da Ação</p>
                    <p className="font-medium">{grau.valor || "—"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Custas Detectadas */}
            {grau.custasDetectadas && grau.custasDetectadas.length > 0 && (
              <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-5 w-5" />
                    Menções a Custas / Guias
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {grau.custasDetectadas.map((item: string, i: number) => (
                    <div key={i} className="text-sm p-3 rounded-lg bg-background border">
                      {item}
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground mt-3">
                    Estas são as movimentações que citam custas, guias ou recolhimento.
                    Use o botão “Emitir / Abrir Guia” para gerar a guia oficial.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Partes */}
            {grau.partes && grau.partes.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Partes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {grau.partes.map((p: any, i: number) => (
                    <div
                      key={i}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border"
                    >
                      <div>
                        <p className="font-medium">{p.nome}</p>
                        <p className="text-sm text-muted-foreground">{p.tipoParticipacao}</p>
                      </div>
                      {p.advogados?.length > 0 && (
                        <div className="text-sm text-right">
                          {p.advogados.map((adv: string, j: number) => (
                            <p key={j} className="text-muted-foreground">
                              {adv}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Últimas Movimentações */}
            {grau.movimentações && grau.movimentações.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Últimas Movimentações</CardTitle>
                  <CardDescription>
                    Mostrando as 12 mais recentes (total: {grau.movimentações.length})
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

            {/* Botão Guia */}
            {resultado.guia?.url && (
              <div className="flex justify-center">
                <Button asChild size="lg" className="gap-2">
                  <a href={resultado.guia.url} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Abrir Portal para Emitir Guia de Custas
                  </a>
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Erro */}
        {resultado && !resultado.success && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive">
                {resultado.note || "Não foi possível enriquecer este processo."}
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
