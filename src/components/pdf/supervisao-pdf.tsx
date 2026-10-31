import React from "react";
import type { SupervisaoSnapshot } from "@/app/actions/supervisao-actions";
import { VisualReportPdf } from "./visual-report-pdf";
import { buildSupervisionVisualReport } from "@/lib/report/report-adapters";

export function SupervisaoPDF({ data, auditor }: { data: SupervisaoSnapshot; geradoEm: string; auditor?: string }) {
  return <VisualReportPdf report={buildSupervisionVisualReport(data, auditor)} />;
}
