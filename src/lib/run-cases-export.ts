/**
 * Usado pela aba Processos — sempre tenta XLSX dossiê; fallback CSV.
 * Importar no cases/page.tsx (client).
 */
"use client";

import {
  exportDossieXlsxAction,
  exportCasesToCSVAction,
} from '@/app/actions/export-actions';

export type ExportToast = (opts: {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}) => void;

export async function runCasesPlanilhaExport(toast: ExportToast): Promise<void> {
  // 1) XLSX dossiê operacional
  try {
    const res = await exportDossieXlsxAction();
    if (res.success && res.base64) {
      const mime =
        res.mime ||
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const a = document.createElement('a');
      a.href = `data:${mime};base64,${res.base64}`;
      a.download = res.filename || 'LexisPredict_Dossie.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast({
        title: 'Dossiê XLSX exportado',
        description:
          res.count != null
            ? `${res.count} processos · Capa + Dashboard + Carteira`
            : 'Arquivo .xlsx baixado',
      });
      return;
    }
    // continua para fallback
    var xlsxErr = (res as any).error || 'XLSX indisponível';
  } catch (e: any) {
    var xlsxErr = e?.message || 'XLSX falhou';
  }

  // 2) CSV fallback
  try {
    const csv = await exportCasesToCSVAction();
    if (csv.success && csv.base64) {
      const a = document.createElement('a');
      a.href = `data:text/csv;base64,${csv.base64}`;
      a.download = csv.filename || 'export_processos.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast({
        title: 'CSV exportado (fallback)',
        description: String(xlsxErr),
      });
      return;
    }
    toast({
      title: 'Falha na exportação',
      description: (csv as any).error || String(xlsxErr),
      variant: 'destructive',
    });
  } catch (e: any) {
    toast({
      title: 'Falha na exportação',
      description: e?.message || String(xlsxErr),
      variant: 'destructive',
    });
  }
}
