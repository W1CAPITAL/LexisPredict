import React from "react";
import { VisualReportPdf } from "./visual-report-pdf";
import { buildOperationalVisualReport } from "@/lib/report/report-adapters";

export type DossieOperacionalData = {
  geradoEm: string;
  empresaNome?: string;
  auditor: string;
  cargo: string;
  kpis: { label: string; value: string }[];
  resumoExecutivo: string[];
  semana: { label: string; series: { day: string; atendidos: number }[]; media: number } | null;
  finance: {
    aReceber: string;
    pago: string;
    vencido: string;
    lancamentos: number;
    destaques: { cliente: string; descricao: string; valor: string; status: string }[];
  } | null;
  claude: { engine: string; texto: string } | null;
  criticos: { cliente: string; protocolo: string; sinal: string; data: string }[];
  topChance: { cliente: string; protocolo: string; prob: number }[];
  notas: number;
};

export function DossieOperacionalPDF({ data }: { data: DossieOperacionalData }) {
  return <VisualReportPdf report={buildOperationalVisualReport(data)} />;
}
