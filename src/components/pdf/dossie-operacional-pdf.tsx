/**
 * Dossiê Operacional — PDF real (arquivo) gerado no navegador.
 * Substitui a dependência do window.print: botão "Baixar PDF" produz o .pdf direto.
 * @copyright 2026 W1 Capital / LexisPredict
 */
import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const C = {
  ink: "#0B1220",
  body: "#1e293b",
  muted: "#475569",
  faint: "#94a3b8",
  line: "#e2e8f0",
  soft: "#f8fafc",
  brand: "#0e7490",
  brandDark: "#164e63",
  brandSoft: "#ecfeff",
  danger: "#dc2626",
  dangerSoft: "#fef2f2",
  warn: "#d97706",
  warnSoft: "#fffbeb",
  ok: "#059669",
  okSoft: "#ecfdf5",
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
  okBox: { backgroundColor: C.okSoft, borderColor: "#a7f3d0", padding: 8, marginBottom: 6, borderRadius: 4 },
  dangerBox: { backgroundColor: C.dangerSoft, borderColor: "#fecaca", padding: 8, marginBottom: 6, borderRadius: 4 },
  small: { fontSize: 7.5, color: C.body, lineHeight: 1.5 },
  smallBold: { fontSize: 7.5, color: C.ink, fontFamily: "Helvetica-Bold" },
  table: { borderWidth: 1, borderColor: C.line, borderRadius: 4, marginBottom: 8 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: C.line },
  rowLast: { flexDirection: "row" },
  th: {
    width: "50%",
    paddingVertical: 5,
    paddingHorizontal: 8,
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: C.faint,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    backgroundColor: C.soft,
  },
  td: { width: "50%", paddingVertical: 5, paddingHorizontal: 8, fontSize: 8, color: C.body },
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

export type DossieOperacionalData = {
  geradoEm: string;
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.row}>
      <Text style={s.th}>{label}</Text>
      <Text style={s.td}>{value}</Text>
    </View>
  );
}

export function DossieOperacionalPDF({ data }: { data: DossieOperacionalData }) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.headerBand}>
          <View style={s.headerRow}>
            <View>
              <Text style={s.brandName}>LEXISPREDICT</Text>
              <Text style={s.brandSub}>Dossiê Operacional · Relatório Consolidado</Text>
            </View>
            <Text style={s.confBadge}>INTERNO • W1 CAPITAL</Text>
          </View>
        </View>

        <View style={s.titleBlock}>
          <Text style={s.h1}>Dossiê Operacional Master</Text>
          <Text style={s.metaLine}>
            Auditado por {data.auditor} {data.cargo ? `· ${data.cargo}` : ""} • Gerado em {data.geradoEm}
          </Text>
          <View style={s.kpiRow}>
            {data.kpis.map((k) => (
              <View key={k.label} style={s.kpi}>
                <Text style={s.kpiLabel}>{k.label}</Text>
                <Text style={s.kpiValue}>{k.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={s.content}>
          <Text style={s.h2}>Resumo executivo</Text>
          <View style={data.resumoExecutivo.length ? s.box : s.okBox}>
            {(data.resumoExecutivo.length ? data.resumoExecutivo : ["Carteira estável: manter rotina."]).map(
              (r, i) => (
                <Text key={i} style={s.small}>
                  • {r}
                </Text>
              )
            )}
          </View>

          {data.semana ? (
            <>
              <Text style={s.h2}>Atendimentos na semana · {data.semana.label}</Text>
              <View style={s.box}>
                <Text style={s.small}>
                  {data.semana.series.map((d) => `${d.day}=${d.atendidos}`).join("  ·  ") || "Sem retornos"} — média{" "}
                  {data.semana.media}/dia
                </Text>
              </View>
            </>
          ) : null}

          {data.finance ? (
            <>
              <Text style={s.h2}>Demonstrativo financeiro (Honorários)</Text>
              <View style={s.box}>
                <Text style={s.small}>
                  A receber: {data.finance.aReceber}   •   Recebido: {data.finance.pago}   •   Vencido:{" "}
                  {data.finance.vencido}   •   Lançamentos: {data.finance.lancamentos}
                </Text>
              </View>
              {data.finance.destaques.length ? (
                <View style={s.table}>
                  {data.finance.destaques.map((d, i) => (
                    <Row
                      key={i}
                      label={`${d.cliente || "—"} (${d.status})`}
                      value={`${d.descricao || "sem descrição"} — ${d.valor}`}
                    />
                  ))}
                </View>
              ) : null}
            </>
          ) : null}

          {data.claude ? (
            <>
              <Text style={s.h2}>Parecer IA · {data.claude.engine}</Text>
              <View style={s.box}>
                <Text style={s.small}>{data.claude.texto}</Text>
              </View>
            </>
          ) : null}

          <Text style={s.h2}>Top criticidade</Text>
          <View style={data.criticos.length ? s.dangerBox : s.okBox}>
            {data.criticos.length ? (
              data.criticos.map((c, i) => (
                <Text key={i} style={s.small}>
                  • {c.cliente} | {c.protocolo} — {c.sinal} {c.data ? `(${c.data})` : ""}
                </Text>
              ))
            ) : (
              <Text style={s.small}>Nenhum sinal crítico.</Text>
            )}
          </View>

          <Text style={s.h2}>Maior chance de encerramento</Text>
          <View style={data.topChance.length ? s.okBox : s.box}>
            {data.topChance.length ? (
              data.topChance.map((c, i) => (
                <Text key={i} style={s.small}>
                  • {c.cliente} | {c.protocolo} — {c.prob}%
                </Text>
              ))
            ) : (
              <Text style={s.small}>Sem previsões ativas.</Text>
            )}
          </View>

          <View style={s.footer} fixed>
            <Text style={s.footerText}>
              Documento interno • LexisPredict • {data.notas} anotações no gabinete
            </Text>
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
