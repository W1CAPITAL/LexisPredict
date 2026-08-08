/**
 * Supervisão — PDF real (arquivo) do snapshot operacional da empresa.
 * @copyright 2026 W1 Capital / LexisPredict
 */
import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { SupervisaoSnapshot } from "@/app/actions/supervisao-actions";

const C = {
  ink: "#0B1220",
  body: "#1e293b",
  muted: "#475569",
  faint: "#94a3b8",
  line: "#e2e8f0",
  soft: "#f8fafc",
  brandDark: "#164e63",
  danger: "#dc2626",
  ok: "#059669",
  white: "#ffffff",
} as const;

const s = StyleSheet.create({
  page: {
    paddingTop: 0,
    paddingBottom: 44,
    paddingHorizontal: 0,
    fontSize: 9,
    color: C.body,
    fontFamily: "Helvetica",
    backgroundColor: C.white,
  },
  headerBand: {
    backgroundColor: C.brandDark,
    paddingTop: 16,
    paddingBottom: 14,
    paddingHorizontal: 30,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brandName: { fontSize: 12, fontFamily: "Helvetica-Bold", color: C.white, letterSpacing: 1.4 },
  brandSub: { fontSize: 7, color: "#a5f3fc", marginTop: 2, letterSpacing: 0.5 },
  confBadge: {
    fontSize: 7,
    color: C.white,
    backgroundColor: "rgba(255,255,255,0.14)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 3,
    letterSpacing: 0.5,
  },
  titleBlock: {
    paddingHorizontal: 30,
    paddingTop: 14,
    paddingBottom: 10,
    backgroundColor: C.soft,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  h1: { fontSize: 15, fontFamily: "Helvetica-Bold", color: C.ink, marginBottom: 3 },
  metaLine: { fontSize: 8, color: C.muted, letterSpacing: 0.2 },
  kpiRow: { flexDirection: "row", gap: 6, marginTop: 10, flexWrap: "wrap" },
  kpi: {
    width: "23%",
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  kpiLabel: {
    fontSize: 6.5,
    color: C.faint,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  kpiValue: { fontSize: 11, fontFamily: "Helvetica-Bold", color: C.ink, marginTop: 2 },
  content: { paddingHorizontal: 30, paddingTop: 12 },
  h2: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    color: C.ink,
    marginTop: 12,
    marginBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    paddingBottom: 3,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  box: {
    backgroundColor: C.soft,
    padding: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 4,
  },
  small: { fontSize: 7.5, color: C.body, lineHeight: 1.5 },
  table: { borderWidth: 1, borderColor: C.line, borderRadius: 4, marginBottom: 8 },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: C.line },
  th: {
    flex: 1,
    paddingVertical: 5,
    paddingHorizontal: 6,
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: C.faint,
    textTransform: "uppercase",
    letterSpacing: 0.2,
    backgroundColor: C.soft,
  },
  td: { flex: 1, paddingVertical: 5, paddingHorizontal: 6, fontSize: 7.5, color: C.body },
  footer: {
    position: "absolute",
    bottom: 22,
    left: 30,
    right: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingTop: 6,
  },
  footerText: { fontSize: 6.5, color: C.faint, letterSpacing: 0.3 },
});

export function SupervisaoPDF({
  data,
  geradoEm,
  auditor,
}: {
  data: SupervisaoSnapshot;
  geradoEm: string;
  auditor?: string;
}) {
  const kpis = [
    { label: "Processos", value: String(data.total) },
    { label: "Ativos", value: String(data.ativos) },
    { label: "Encerrados", value: String(data.encerrados) },
    { label: "Vencidos", value: String(data.vencidos) },
    { label: "B.A.", value: String(data.ba) },
    { label: "Novidades", value: String(data.novidades) },
    { label: "Atend. geral", value: String(data.atendimentosTotais) },
    { label: "Atend. semana", value: String(data.atendidosSemana) },
  ];
  const cols = ["Responsável", "Total", "Ativos", "Vencidos", "Novid.", "Atend.", "Sem."];

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.headerBand}>
          <View style={s.headerRow}>
            <View>
              <Text style={s.brandName}>LEXISPREDICT</Text>
              <Text style={s.brandSub}>Painel de Supervisão · Visão geral da empresa</Text>
            </View>
            <Text style={s.confBadge}>INTERNO • SUPERVISÃO</Text>
          </View>
        </View>

        <View style={s.titleBlock}>
          <Text style={s.h1}>Supervisão Operacional</Text>
          <Text style={s.metaLine}>
            {auditor ? `Auditado por ${auditor} • ` : ""}Gerado em {geradoEm}
          </Text>
          <View style={s.kpiRow}>
            {kpis.map((k) => (
              <View key={k.label} style={s.kpi}>
                <Text style={s.kpiLabel}>{k.label}</Text>
                <Text style={s.kpiValue}>{k.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={s.content}>
          <Text style={s.h2}>Atendimentos · últimas 8 semanas</Text>
          <View style={s.box}>
            <Text style={s.small}>
              {data.timelineSemanal.map((t) => `${t.label}=${t.atendidos}`).join("  ·  ") || "Sem retornos"}
            </Text>
          </View>

          <Text style={s.h2}>Distribuição por tribunal</Text>
          <View style={s.box}>
            {data.porTribunal.length
              ? data.porTribunal.map((t, i) => (
                  <Text key={i} style={s.small}>
                    • {t.label} — {t.value}
                  </Text>
                ))
              : null}
          </View>

          <Text style={s.h2}>Operadores · desempenho</Text>
          <View style={s.table}>
            <View style={s.tr}>
              {cols.map((c) => (
                <Text key={c} style={s.th}>
                  {c}
                </Text>
              ))}
            </View>
            {data.operadores.length ? (
              data.operadores.map((op, i) => (
                <View key={i} style={s.tr}>
                  <Text style={s.td}>{op.nome}</Text>
                  <Text style={s.td}>{op.total}</Text>
                  <Text style={s.td}>{op.ativos}</Text>
                  <Text style={s.td}>{op.vencidos}</Text>
                  <Text style={s.td}>{op.novidades}</Text>
                  <Text style={s.td}>{op.atendimentos}</Text>
                  <Text style={s.td}>{op.atendidosSemana}</Text>
                </View>
              ))
            ) : (
              <View style={s.tr}>
                <Text style={s.td}>Sem operadores</Text>
                <Text style={s.td}>—</Text>
                <Text style={s.td}>—</Text>
                <Text style={s.td}>—</Text>
                <Text style={s.td}>—</Text>
                <Text style={s.td}>—</Text>
                <Text style={s.td}>—</Text>
              </View>
            )}
          </View>

          <Text style={s.h2}>Sinais de atenção</Text>
          <View style={s.box}>
            <Text style={s.small}>
              Vencidos: {data.vencidos}  •  B.A.: {data.ba}  •  Novidades: {data.novidades}  •  Sem retorno:{" "}
              {data.semRetorno}
            </Text>
          </View>

          <View style={s.footer} fixed>
            <Text style={s.footerText}>Documento interno • LexisPredict • Supervisão</Text>
            <Text
              style={s.footerText}
              render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
            />
          </View>
        </View>
      </Page>
    </Document>
  );
}
