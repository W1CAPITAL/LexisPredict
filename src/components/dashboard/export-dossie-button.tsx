"use client";

import React, { useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { exportDossieXlsxAction } from "@/app/actions/export-dossie-xlsx";
import { downloadBase64File } from "@/lib/download-export";
import { cn } from "@/lib/utils";

/** Botão para gerar XLSX estilo Dossiê (Painel ou Report) */
export function ExportDossieButton({ className }: { className?: string }) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const onClick = async () => {
    setLoading(true);
    try {
      const res = await exportDossieXlsxAction();
      if (res.success && res.base64) {
        downloadBase64File(
          res.base64,
          res.filename!,
          res.mime || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        toast({
          title: "Dossiê XLSX gerado",
          description: `${res.count} processos · Dashboard + carteira completa`,
        });
      } else {
        toast({
          title: "Falha na exportação",
          description: (res as any).error || "Tente de novo",
          variant: "destructive",
        });
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      disabled={loading}
      className={cn("rounded-xl font-bold uppercase text-[10px] tracking-wider gap-2", className)}
    >
      {loading ? <Loader2 className="animate-spin" size={16} /> : <FileSpreadsheet size={16} />}
      Exportar XLSX Dossiê
    </Button>
  );
}
