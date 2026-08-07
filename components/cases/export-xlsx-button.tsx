"use client";

/**
 * Botão visível: Exportar XLSX Dossiê (não altera o CSV).
 */

import React, { useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { exportDossieXlsxAction } from "@/app/actions/export-actions";
import { cn } from "@/lib/utils";

export function ExportXlsxDossieButton({
  className,
  label = "Exportar XLSX",
}: {
  className?: string;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const onClick = async () => {
    setLoading(true);
    try {
      const res = await exportDossieXlsxAction();
      if (res.success && res.base64) {
        const mime =
          res.mime ||
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        const a = document.createElement("a");
        a.href = `data:${mime};base64,${res.base64}`;
        a.download = res.filename || "LexisPredict_Dossie.xlsx";
        document.body.appendChild(a);
        a.click();
        a.remove();
        toast({
          title: "XLSX dossiê baixado",
          description:
            res.count != null
              ? `${res.count} processos · Capa + Dashboard + Carteira`
              : undefined,
        });
      } else {
        toast({
          title: "Falha no XLSX",
          description: (res as { error?: string }).error || "Tente de novo",
          variant: "destructive",
        });
      }
    } catch (e: any) {
      toast({
        title: "Erro ao exportar XLSX",
        description: e?.message || "Falha",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={loading}
      className={cn(
        "h-10 px-4 rounded-xl font-black uppercase text-[10px] tracking-widest border-2 border-primary/40 text-primary hover:bg-primary/5 gap-2 shrink-0",
        className
      )}
    >
      {loading ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        <FileSpreadsheet size={16} />
      )}
      {label}
    </Button>
  );
}
