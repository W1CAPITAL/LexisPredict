import React from "react";
import { VisualReportPdf } from "./visual-report-pdf";
import { buildTeamVisualReport, type TeamReportInput } from "@/lib/report/report-adapters";
export type { ReportPdfOverview, ReportPdfDay } from "@/lib/report/report-adapters";

export function ReportTeamSummaryPdf(props: TeamReportInput) {
  return <VisualReportPdf report={buildTeamVisualReport(props)} />;
}
