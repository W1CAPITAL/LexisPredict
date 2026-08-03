"use client";

import React, { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Camera, FileText, Search, ExternalLink, Scale } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  enrichWithEsaJAction,
  captureScreenshotAction,
  getGuiaJudicialAction,
  getConsultaUrlAction,
} from "@/app/actions/esa-j-actions";

export default function AutomacaoJudicialPage() {
  const [cnj, setCnj] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [resultado, setResultado] = useState<any>(null);
  const { toast } = useToast();

  const cleanCnj = cnj.replace(/\D/g, "");

  const handleEnrich = async () => {
    if (cleanCnj.length !== 20) {
      toast({ title: "CNJ inválido", variant: "destructive" });
      return;
    }
    setLoading("enrich");
    try {
      const res = await enrichWithEsaJAction(cnj);
      setResultado(res);
      toast({ title: res.success ? "Dados enriquecidos" : "Tribunal não é e-SAJ ou falha" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  const handleScreenshot = async () => {
    if (cleanCnj.length !== 20) return;
    setLoading("screenshot");
    try {
      const urlRes = await getConsultaUrlAction(cnj);
      if (!urlRes?.url) {
        toast({ title: "URL de consulta não encontrada", variant: "destructive" });
        return;
      }
      const res = await captureScreenshotAction(cnj, urlRes.url);
      if (res.success) {
        toast({ title: "Screenshot capturado e salvo!", description: res.path });
        setResultado((prev: any) => ({ ...prev, screenshot: res.path }));
      } else {
        toast({ title: "Falha na captura", description: res.error, variant: "destructive" });
      }
    } finally {
      setLoading(null);
    }
  };

  const handleGuia = async () => {
    if (cleanCnj.length !== 20) return;
    setLoading("guia");
    try {
      const res = await getGuiaJudicialAction(cnj);
      setResultado((prev: any) => ({ ...prev, guia: res }));
      if (res?.url) window.open(res.url, "_blank");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6 md:p-10 max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Scale className="w-6 h-6" /> Automação Judicial
          </h1>
          <p className="text-muted-foreground mt-1">
            Enriquecimento e-SAJ • Captura de tela real • Guias judiciais • Todos os tribunais CNJ
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Número do Processo (CNJ)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="0000000-00.0000.0.00.0000"
              value={cnj}
              onChange={(e) => setCnj(e.target.value)}
              className="text-lg font-mono"
            />

            <div className="flex flex-wrap gap-3">
              <Button onClick={handleEnrich} disabled={!!loading}>
                {loading === "enrich" ? <Loader2 className="animate-spin mr-2" /> : <Search className="mr-2 h-4 w-4" />}
                Enriquecer (e-SAJ)
              </Button>

              <Button onClick={handleScreenshot} disabled={!!loading} variant="secondary">
                {loading === "screenshot" ? <Loader2 className="animate-spin mr-2" /> : <Camera className="mr-2 h-4 w-4" />}
                Capturar Tela Real
              </Button>

              <Button onClick={handleGuia} disabled={!!loading} variant="outline">
                {loading === "guia" ? <Loader2 className="animate-spin mr-2" /> : <FileText className="mr-2 h-4 w-4" />}
                Emitir / Abrir Guia
              </Button>
            </div>
          </CardContent>
        </Card>

        {resultado && (
          <Card>
            <CardHeader>
              <CardTitle>Resultado</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs overflow-auto bg-muted p-4 rounded-lg max-h-96">
                {JSON.stringify(resultado, null, 2)}
              </pre>
              {resultado.guia?.url && (
                <Button asChild className="mt-4" variant="link">
                  <a href={resultado.guia.url} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" /> Abrir portal da guia
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
