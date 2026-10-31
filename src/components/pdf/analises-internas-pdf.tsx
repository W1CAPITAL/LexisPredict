import React from "react";
import { VisualReportPdf } from "./visual-report-pdf";
import { buildPersonalVisualReport } from "@/lib/report/report-adapters";

export type AnalisePdfRow = {
  id: string;
  protocolo_ref: string | null;
  categoria: string | null;
  descricao: string | null;
  origem: string | null;
  data_atividade: string | null;
  nivel_conferencia: string | null;
};
export type AtividadePdfRow = {
  id: string;
  titulo: string | null;
  categoria: string | null;
  descricao: string | null;
  data_realizacao: string | null;
  protocolo_ref: string | null;
};
export type AcaoPdfRow = {
  id: string;
  action: string;
  created_at: string | null;
  protocolo_ref: string | null;
};
export type AnalisesPessoaisPdfData = {
  nome: string;
  empresa?: string;
  geradoEm: string;
  filtros: { busca: string; categoria: string };
  paginas: { analises: number; atividades: number; acoes: number };
  totais: { analises: number; atividades: number; acoes: number; documentais: number };
  analises: AnalisePdfRow[];
  atividades: AtividadePdfRow[];
  acoes: AcaoPdfRow[];
};

export function AnalisesPessoaisPdf({ data }: { data: AnalisesPessoaisPdfData }) {
  return <VisualReportPdf report={buildPersonalVisualReport(data)} />;
}
