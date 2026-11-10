import React from "react";
import type { SupervisaoSnapshot } from "@/app/actions/supervisao-actions";
import { VisualReportPdf } from "./visual-report-pdf";
import { buildSupervisionVisualReport } from "@/lib/report/report-adapters";
import { buildHermesPdfSections } from '@/lib/report/hermes-report-sections';
import type { HermesOfficeDailyRow } from '@/lib/hermes-company-service';
import type { HermesCaseHealth } from '@/lib/hermes-company-intelligence';
import type {HermesPortfolioDiagnostics} from '@/lib/hermes-diagnostics-policy';

export function SupervisaoPDF({ data, auditor, hermesRow, hermesCases,hermesDiagnostics }: { data: SupervisaoSnapshot; geradoEm: string; auditor?: string; hermesRow?: HermesOfficeDailyRow | null; hermesCases?: HermesCaseHealth[]; hermesDiagnostics?:HermesPortfolioDiagnostics|null }) {
  const report = buildSupervisionVisualReport(data, auditor);
  return <VisualReportPdf report={{...report, sections:[...report.sections,...buildHermesPdfSections(hermesRow||null,hermesCases||[],hermesDiagnostics||null)]}} />;
}
