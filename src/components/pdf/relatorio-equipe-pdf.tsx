import React from "react";
import type { RelatorioEquipeData } from "@/lib/relatorio-equipe-narrativa";
import { VisualReportPdf } from "./visual-report-pdf";
import { buildNarrativeVisualReport } from "@/lib/report/report-adapters";

export function RelatorioEquipePDF({ data }: { data: RelatorioEquipeData }) {
  return <VisualReportPdf report={buildNarrativeVisualReport(data)} />;
}
