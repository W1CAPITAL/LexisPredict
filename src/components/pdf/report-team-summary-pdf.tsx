import React from "react";
import { VisualReportPdf } from "./visual-report-pdf";
import { buildTeamVisualReport, type TeamReportInput } from "@/lib/report/report-adapters";
import { buildHermesPdfSections } from '@/lib/report/hermes-report-sections';
import type { HermesOfficeDailyRow } from '@/lib/hermes-company-service';
import type { HermesCaseHealth } from '@/lib/hermes-company-intelligence';
import type {HermesPortfolioDiagnostics} from '@/lib/hermes-diagnostics-policy';
export type { ReportPdfOverview, ReportPdfDay } from "@/lib/report/report-adapters";

export function ReportTeamSummaryPdf(props: TeamReportInput & { hermesRow?: HermesOfficeDailyRow | null; hermesCases?: HermesCaseHealth[];hermesDiagnostics?:HermesPortfolioDiagnostics|null }) {
  const report = buildTeamVisualReport(props);
  const sections = props.scope === 'Empresa inteira'
    ? buildHermesPdfSections(props.hermesRow || null, props.hermesCases || [],props.hermesDiagnostics||null) : [];
  return <VisualReportPdf report={{...report,sections:[...report.sections,...sections]}} />;
}
