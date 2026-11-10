import React from "react";
import type { RelatorioEquipeData } from "@/lib/relatorio-equipe-narrativa";
import { VisualReportPdf } from "./visual-report-pdf";
import { buildNarrativeVisualReport } from "@/lib/report/report-adapters";
import { buildHermesPdfSections } from '@/lib/report/hermes-report-sections';
import type { HermesOfficeDailyRow } from '@/lib/hermes-company-service';
import type { HermesCaseHealth } from '@/lib/hermes-company-intelligence';

export function RelatorioEquipePDF({ data, hermesRow, hermesCases }: { data: RelatorioEquipeData; hermesRow?: HermesOfficeDailyRow | null; hermesCases?: HermesCaseHealth[] }) {
  const report = buildNarrativeVisualReport(data);
  return <VisualReportPdf report={{...report,sections:[...report.sections,...buildHermesPdfSections(hermesRow||null,hermesCases||[])]}} />;
}
