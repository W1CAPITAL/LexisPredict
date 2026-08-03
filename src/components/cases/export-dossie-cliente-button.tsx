"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { exportClienteDossieAction } from "@/app/actions/dossie-cliente-action";
import { cn } from "@/lib/utils";

type Props = {
  protocolo: string;
  className?: string;
  size?: "icon" | "sm";
};

export function ExportDossieClienteButton({ protocolo, className, size = "icon" }: Props) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const run = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!protocolo || loading) return;
    setLoading(true);
    try {
      const res = await exportClienteDossieAction(protocolo);
      if (!res?.success || !(res as any).base64) {
        toast({
          title: "Falha no dossiê",
          description: (res as any)?.error || "Não foi possível gerar o PDF",
          variant: "destructive",
        });
        return;
      }
      const bin = atob((res as any).base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: (res as any).mime || "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = (res as any).filename || "dossie-cliente.pdf";
      a.click();
      URL.revokeObjectURL(url);
      toast({
        title: "Dossiê gerado",
        description: `Risco ${(res as any).risco || ""} (${(res as any).score ?? "—"}/100)`,
      });
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message || "Falha no download", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (size === "sm") {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={run}
        disabled={loading}
        title="Exportar dossiê do cliente (movimentos + DJEN + risco)"
        className={cn(
          "h-9 rounded-xl font-black uppercase text-[9px] tracking-widest gap-1 border-2",
          className
        )}
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
        Dossiê
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={run}
      disabled={loading}
      title="Exportar dossiê do cliente"
      className={cn("h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary", className)}
    >
      {loading ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
    </Button>
  );
}
