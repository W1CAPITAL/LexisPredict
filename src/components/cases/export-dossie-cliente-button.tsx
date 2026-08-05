"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { FileDown, Loader2, Sparkles } from "lucide-react";
import {
  exportClienteDossieAction,
  type DossieEditableFields,
} from "@/app/actions/dossie-cliente-action";

/** Default = Claude / OmniRoute (sem local_only no enriquecimento) */
const MOTORS = [
  { id: "claude", label: "Claude / OmniRoute (padrão)" },
  { id: "omniroute", label: "OmniRoute gateway" },
  { id: "auto", label: "Auto (OmniRoute → Grok → Groq)" },
  { id: "xai", label: "xAI Grok" },
  { id: "groq-llama", label: "Groq Llama" },
];

export function ExportDossieClienteButton({
  protocolo,
  className,
}: {
  protocolo: string;
  className?: string;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [engine, setEngine] = useState<string>("");
  const [claudeWarn, setClaudeWarn] = useState<string>("");
  const [motor, setMotor] = useState("claude");
  const [edited, setEdited] = useState<DossieEditableFields>({});

  const set = (k: keyof DossieEditableFields, v: string | number) =>
    setEdited((prev) => ({ ...prev, [k]: v }));

  const openPreview = async () => {
    setLoading(true);
    setClaudeWarn("");
    try {
      const res = await exportClienteDossieAction(protocolo, {
        previewOnly: true,
        useClaude: true,
        preferredMotor: motor || "claude",
      } as any);
      if (!res.success) {
        toast({
          title: "Dossiê",
          description: (res as any).error || "Falha",
          variant: "destructive",
        });
        return;
      }
      setEdited((res as any).preview || {});
      setEngine((res as any).engine || "");
      if ((res as any).claudeError) {
        setClaudeWarn(String((res as any).claudeError));
        toast({
          title: "Claude com falha",
          description: String((res as any).claudeError).slice(0, 180),
          variant: "destructive",
        });
      }
      setOpen(true);
    } catch (e: any) {
      toast({
        title: "Erro",
        description: e?.message || "Falha",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  /** PDF final: usa apenas campos editados — não reconsulta Claude */
  const generatePdf = async () => {
    setSaving(true);
    try {
      const res = await exportClienteDossieAction(protocolo, {
        previewOnly: false,
        useClaude: false,
        preferredMotor: motor,
        edited,
      } as any);
      if (!res.success || !(res as any).base64) {
        toast({
          title: "PDF",
          description: (res as any).error || "Falha ao gerar",
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
      a.download = (res as any).filename || "dossie.pdf";
      a.click();
      URL.revokeObjectURL(url);
      setOpen(false);
      toast({ title: "Dossiê gerado", description: (res as any).filename });
    } catch (e: any) {
      toast({
        title: "Erro",
        description: e?.message || "Falha",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const Field = ({
    label,
    k,
    rows,
  }: {
    label: string;
    k: keyof DossieEditableFields;
    rows?: number;
  }) => (
    <div className="space-y-1">
      <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
        {label}
      </Label>
      {rows ? (
        <textarea
          className="w-full min-h-[72px] rounded-xl border-2 border-border bg-background p-2 text-xs font-medium"
          rows={rows}
          value={String(edited[k] ?? "")}
          onChange={(e) => set(k, e.target.value)}
        />
      ) : (
        <Input
          className="h-10 rounded-xl text-xs font-bold"
          value={String(edited[k] ?? "")}
          onChange={(e) => set(k, e.target.value)}
        />
      )}
    </div>
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={motor} onValueChange={setMotor}>
          <SelectTrigger className="h-9 w-[240px] rounded-xl text-[9px] font-black uppercase">
            <SelectValue placeholder="Motor IA" />
          </SelectTrigger>
          <SelectContent>
            {MOTORS.map((m) => (
              <SelectItem key={m.id} value={m.id} className="text-[10px] font-bold">
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          className={className || "rounded-xl font-black uppercase text-[9px]"}
          onClick={openPreview}
          disabled={loading || !protocolo}
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FileDown className="mr-2 h-4 w-4" />
          )}
          Dossiê PDF
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto rounded-xl border-2 border-black">
          <DialogHeader>
            <DialogTitle className="font-black uppercase text-sm tracking-widest flex items-center gap-2">
              <Sparkles size={16} className="text-primary" />
              Revisar dossiê antes do PDF
              {engine ? (
                <span className="text-[9px] font-bold text-muted-foreground normal-case">
                  · motor: {engine}
                </span>
              ) : null}
            </DialogTitle>
          </DialogHeader>

          {claudeWarn ? (
            <p className="text-[11px] text-red-600 font-bold border border-red-200 bg-red-50 p-2 rounded-lg">
              {claudeWarn}
            </p>
          ) : null}

          <p className="text-[11px] text-muted-foreground">
            Edite os campos abaixo. O PDF (layout premium Marlene) só é gerado depois de você
            confirmar — sem nova chamada à IA.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Cliente" k="cliente" />
            <Field label="Protocolo" k="protocolo" />
            <Field label="Advogado" k="advogado" />
            <Field label="Escritório" k="escritorio" />
            <Field label="Tribunal" k="tribunal" />
            <Field label="Status" k="status" />
            <Field label="Telefone" k="telefone" />
            <Field label="Parte contrária" k="parteContraria" />
            <Field label="Último retorno" k="ultimoRetorno" />
            <Field label="Próximo prazo" k="proximoPrazo" />
            <Field label="Fase atual" k="faseAtual" />
            <Field label="Nível de risco" k="nivel" />
            <div className="space-y-1">
              <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                Score (0-100)
              </Label>
              <Input
                type="number"
                className="h-10 rounded-xl text-xs font-bold"
                value={Number(edited.score ?? 0)}
                onChange={(e) => set("score", Number(e.target.value))}
              />
            </div>
            <Field label="Chance / orientação" k="chanceRuim" />
          </div>

          <Field label="Resumo do processo" k="resumoProcesso" rows={4} />
          <Field label="Observações CRM" k="observacao" rows={2} />
          <Field label="Pontos fortes (1 por linha)" k="pontosFortes" rows={3} />
          <Field label="Pontos de atenção (1 por linha)" k="pontosAtencao" rows={3} />
          <Field label="Plano de ação (1 por linha)" k="planoAcao" rows={3} />
          <Field label="Leitura estratégica" k="leituraEstrategica" rows={3} />

          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="rounded-xl font-black uppercase text-[10px] bg-black text-white"
              onClick={generatePdf}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="mr-2 h-4 w-4" />
              )}
              Gerar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
