import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { RelatorioEquipeData } from "@/lib/relatorio-equipe-narrativa";

const C = {
  ink: "#1A1A1A",
  muted: "#555555",
  line: "#E4E4E4",
  navy: "#161616",
  gold: "#B8954A",
  wash: "#F3F7F4",
  cream: "#F7F3EA",
  white: "#FFFFFF",
};

const s = StyleSheet.create({
  page: { paddingTop: 0, paddingBottom: 36, paddingHorizontal: 0, fontSize: 9.2, color: C.ink, fontFamily: "Helvetica", backgroundColor: C.white },
  band: { backgroundColor: C.navy, paddingTop: 16, paddingBottom: 14, paddingHorizontal: 28 },
  gold: { height: 3, backgroundColor: C.gold },
  brand: { fontSize: 8, color: "#C8C8C8", marginBottom: 4 },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold", color: C.white },
  meta: { fontSize: 8, color: "#C8C8C8", marginTop: 4 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  body: { paddingHorizontal: 28, paddingTop: 14 },
  kpiRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  kpi: { width: "23%", borderWidth: 0.6, borderColor: C.line, borderRadius: 4, paddingVertical: 7, paddingHorizontal: 7 },
  kpiV: { fontSize: 13, fontFamily: "Helvetica-Bold", color: C.ink },
  kpiL: { fontSize: 7, color: C.muted, marginTop: 2 },
  wa: { backgroundColor: C.wash, borderRadius: 4, padding: 8, marginBottom: 12 },
  waT: { fontSize: 9, color: C.ink, lineHeight: 1.4 },
  waS: { fontSize: 8, color: C.muted, marginTop: 3 },
  h: { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.navy, marginTop: 10, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: C.gold, paddingBottom: 2 },
  card: { borderWidth: 0.6, borderColor: C.line, borderRadius: 4, padding: 8, marginBottom: 6 },
  nome: { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.ink },
  papel: { fontSize: 8, color: C.muted, marginTop: 2 },
  nums: { fontSize: 7.5, color: C.muted, marginTop: 3 },
  p: { fontSize: 9.2, color: C.ink, lineHeight: 1.45, marginBottom: 7 },
  cream: { backgroundColor: C.cream, borderRadius: 4, padding: 9, marginTop: 8, marginBottom: 8 },
  creamH: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#9A5B12", marginBottom: 4 },
  foot: { position: "absolute", bottom: 14, left: 28, right: 28, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 0.5, borderTopColor: C.line, paddingTop: 5 },
  footT: { fontSize: 7, color: C.muted },
});

export function RelatorioEquipePDF({ data }: { data: RelatorioEquipeData }) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.gold} />
        <View style={s.band}>
          <View style={s.row}>
            <View>
              <Text style={s.brand}>W1 CAPITAL  ·  aplicativo de gestão para assessoria financeira</Text>
              <Text style={s.title}>Relatório da equipe</Text>
              <Text style={s.meta}>{data.geradoEm}  ·  {data.periodoLabel}</Text>
            </View>
            <Text style={s.meta}>Uso interno</Text>
          </View>
        </View>

        <View style={s.body}>
          <View style={s.kpiRow}>
            {data.kpis.map((k) => (
              <View key={k.rotulo} style={s.kpi}>
                <Text style={s.kpiV}>{k.valor}</Text>
                <Text style={s.kpiL}>{k.rotulo}</Text>
              </View>
            ))}
          </View>

          <View style={s.wa}>
            <Text style={s.waT}>{data.whatsapp}</Text>
            <Text style={s.waS}>Isso vale mais do que gráfico. É o canal que mais vira reclamação quando estoura.</Text>
          </View>

          <Text style={s.h}>Como a casa está dividida</Text>
          {data.pessoas.length ? data.pessoas.map((p) => (
            <View key={p.nome} style={s.card} wrap={false}>
              <Text style={s.nome}>{p.nome}</Text>
              <Text style={s.papel}>{p.papel}</Text>
              <Text style={s.nums}>{p.linha}</Text>
            </View>
          )) : <Text style={s.p}>Sem quebra por pessoa neste corte.</Text>}

          <Text style={s.h}>O que esses números querem dizer</Text>
          {data.leitura.map((t, i) => (
            <Text key={i} style={s.p}>{t}</Text>
          ))}
        </View>
        <View style={s.foot} fixed>
          <Text style={s.footT}>W1 Capital · aplicativo de gestão para assessoria financeira · uso interno</Text>
          <Text style={s.footT} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>

      <Page size="A4" style={s.page}>
        <View style={s.gold} />
        <View style={s.band}>
          <Text style={s.title}>Relatório da equipe</Text>
          <Text style={s.meta}>{data.geradoEm}</Text>
        </View>
        <View style={s.body}>
          <Text style={s.h}>O que cada canal segura</Text>
          {data.canais.map((t, i) => (
            <Text key={i} style={s.p}>{t}</Text>
          ))}

          <Text style={s.h}>O que o painel não conta sozinho</Text>
          {data.esconde.map((t, i) => (
            <Text key={i} style={s.p}>{t}</Text>
          ))}

          <View style={s.cream}>
            <Text style={s.creamH}>Para quem supervisiona</Text>
            <Text style={s.p}>{data.recado}</Text>
          </View>

          <Text style={s.h}>Semana que vem</Text>
          {data.proxima.map((t, i) => (
            <Text key={i} style={s.p}>–  {t}</Text>
          ))}
        </View>
        <View style={s.foot} fixed>
          <Text style={s.footT}>W1 Capital · aplicativo de gestão para assessoria financeira · uso interno</Text>
          <Text style={s.footT} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
