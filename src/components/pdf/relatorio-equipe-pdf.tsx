import React from "react";
import type { RelatorioEquipeData } from "@/lib/relatorio-equipe-narrativa";
import { VisualReportPdf } from "./visual-report-pdf";
import { buildNarrativeVisualReport } from "@/lib/report/report-adapters";
import { buildHermesPdfSections } from '@/lib/report/hermes-report-sections';
import type { HermesOfficeDailyRow } from '@/lib/hermes-company-service';
import type { HermesCaseHealth } from '@/lib/hermes-company-intelligence';
import type {HermesPortfolioDiagnostics} from '@/lib/hermes-diagnostics-policy';

export function RelatorioEquipePDF({ data, hermesRow, hermesCases,hermesDiagnostics }: { data: RelatorioEquipeData; hermesRow?: HermesOfficeDailyRow | null; hermesCases?: HermesCaseHealth[];hermesDiagnostics?:HermesPortfolioDiagnostics|null }) {
  const report = buildNarrativeVisualReport(data);
  return <VisualReportPdf report={{...report,sections:[...report.sections,...buildHermesPdfSections(hermesRow||null,hermesCases||[],hermesDiagnostics||null)]}} />;
}
