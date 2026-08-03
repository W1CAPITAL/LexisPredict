"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Loader2, Save, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { exportClienteDossieAction } from "@/app/actions/dossie-cliente-action";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type Props = {
  protocolo: string;
  className?: string;
  size?: "icon" | "sm";
};

export function ExportDossieClienteButton({ protocolo, className, size = "icon" }: Props) {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [edited, setEdited] = useState({
    resumo: "",
    pontosFortes: "",
    pontosAtencao: "",
    leituraEstrategica: "",
    planoAcao: "",
  });
  const { toast } = useToast();

  // 1º clique → carrega o dossiê e abre o modal editável
  const handleOpen = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!protocolo || loading) return;

    setLoading(true);
    try {
      const res = await exportClienteDossieAction(protocolo, { previewOnly: true });

      if (!res?.success) {
        toast({
          title: "Falha ao carregar dossiê",
          description: (res as any)?.error || "Não foi possível gerar a análise",
          variant: "destructive",
        });
        return;
      }

      const data = (res as any).preview;
      setPreview(data);

      // Preenche os campos editáveis
      setEdited({
        resumo: data.resumoProcesso || "",
        pontosFortes: (data.risco?.pontosFortes || []).join("\n• "),
        pontosAtencao: (data.risco?.pontosAtencao || []).join("\n• "),
        leituraEstrategica: data.risco?.leituraEstrategica || "",
        planoAcao: (data.risco?.planoAcao || []).join("\n• "),
      });

      setOpen(true);
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message || "Falha", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // 2º passo → gera o PDF final com as edições
  const handleGeneratePDF = async () => {
    if (!preview) return;
    setLoading(true);
    try {
      const res = await exportClienteDossieAction(protocolo, {
        editedContent: edited,
      });

      if (!res?.success || !(res as any).base64) {
        toast({
          title: "Falha no PDF",
          description: (res as any)?.error || "Não foi possível gerar o PDF",
          variant: "destructive",
        });
        return;
      }

      const bin = atob((res as any).base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = (res as any).filename || "dossie-cliente.pdf";
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: "Dossiê gerado com sucesso",
        description: `Risco ${(res as any).risco || ""} (${(res as any).score ?? "—"}/100)`,
      });
      setOpen(false);
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message || "Falha no download", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant={size === "sm" ? "outline" : "ghost"}
        size={size === "sm" ? "sm" : "icon"}
        onClick={handleOpen}
        disabled={loading}
        title="Dossiê reputacional (editável)"
        className={cn(
          size === "sm"
            ? "h-9 rounded-xl font-black uppercase text-[9px] tracking-widest gap-1 border-2"
            : "h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary",
          className
        )}
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <FileText size={size === "sm" ? 14 : 15} />}
        {size === "sm" && "Dossiê"}
      </Button>

      {/* ====== MODAL EDITÁVEL ====== */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Dossiê Reputacional – Edição
            </DialogTitle>
            <DialogDescription>
              Revise e edite os pontos antes de gerar o PDF final.
              {preview && (
                <span className="ml-2">
                  <Badge variant="secondary">
                    Risco: {preview.risco?.nivel} ({preview.risco?.score}/100)
                  </Badge>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Resumo Executivo */}
            <div className="space-y-2">
              <Label>Resumo Executivo</Label>
              <Textarea
                value={edited.resumo}
                onChange={(e) => setEdited({ ...edited, resumo: e.target.value })}
                rows={4}
                className="text-sm"
              />
            </div>

            {/* Pontos Fortes */}
            <div className="space-y-2">
              <Label className="text-green-700 dark:text-green-400">Pontos Fortes</Label>
              <Textarea
                value={edited.pontosFortes}
                onChange={(e) => setEdited({ ...edited, pontosFortes: e.target.value })}
                rows={4}
                className="text-sm border-green-200"
                placeholder="Um ponto por linha..."
              />
            </div>

            {/* Pontos de Atenção / Negativos */}
            <div className="space-y-2">
              <Label className="text-amber-700 dark:text-amber-400">
                Pontos de Atenção (o que pode prejudicar)
              </Label>
              <Textarea
                value={edited.pontosAtencao}
                onChange={(e) => setEdited({ ...edited, pontosAtencao: e.target.value })}
                rows={5}
                className="text-sm border-amber-200"
                placeholder="Um ponto por linha..."
              />
            </div>

            {/* Leitura Estratégica */}
            <div className="space-y-2">
              <Label>Leitura Estratégica / Reputacional</Label>
              <Textarea
                value={edited.leituraEstrategica}
                onChange={(e) => setEdited({ ...edited, leituraEstrategica: e.target.value })}
                rows={3}
                className="text-sm"
              />
            </div>

            {/* Plano de Ação */}
            <div className="space-y-2">
              <Label>Plano de Ação Recomendado</Label>
              <Textarea
                value={edited.planoAcao}
                onChange={(e) => setEdited({ ...edited, planoAcao: e.target.value })}
                rows={4}
                className="text-sm"
                placeholder="Um item por linha..."
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              <X className="h-4 w-4 mr-1" />
              Cancelar
            </Button>
            <Button onClick={handleGeneratePDF} disabled={loading} className="gap-2">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Gerar PDF Final
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
