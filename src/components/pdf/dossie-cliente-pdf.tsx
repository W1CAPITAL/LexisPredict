/**
 * Dossiê do cliente — movimentação, DJEN, observações, risco
 */
import React from "react";
import { Page, Text, View, Document, StyleSheet, Font, Image } from "@react-pdf/renderer";

Font.register({
  family: "Times-Roman",
  fonts: [
    { src: "https://cdn.jsdelivr.net/npm/@canvas-fonts/times-new-roman@1.0.4/Times-New-Roman.ttf" },
    {
      src: "https://cdn.jsdelivr.net/npm/@canvas-fonts/times-new-roman@1.0.4/Times-New-Roman-Bold.ttf",
      fontWeight: "bold",
    },
  ],
});

const C = {
  ink: "#0f172a",
  muted: "#64748b",
  line: "#e2e8f0",
  brand: "#0c4a6e",
  soft: "#f8fafc",
  danger: "#b91c1c",
  warn: "#b45309",
  ok: "#15803d",
};

const s = StyleSheet.create({
  page: { paddingTop: 28, paddingBottom: 44, paddingHorizontal: 34, fontFamily: "Times-Roman", fontSize: 10, color: C.ink },
  brand: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 2, borderBottomColor: C.brand, paddingBottom: 8, marginBottom: 12 },
  brandName: { fontSize: 12, fontWeight: "bold", color: C.brand, textTransform: "uppercase" },
  brandSub: { fontSize: 7, color: C.muted, textTransform: "uppercase", marginTop: 2 },
  logo: { width: 32, height: 32 },
  title: { fontSize: 13, fontWeight: "bold", textAlign: "center", textTransform: "uppercase", color: C.brand, marginBottom: 10 },
  box: { backgroundColor: C.soft, borderWidth: 1, borderColor: C.line, padding: 9, marginBottom: 10 },
  row: { flexDirection: "row", marginBottom: 2 },
  lab: { width: 120, fontSize: 8, fontWeight: "bold", color: C.muted, textTransform: "uppercase" },
  val: { flex: 1, fontSize: 9.5 },
  h2: { fontSize: 9, fontWeight: "bold", textTransform: "uppercase", color: C.brand, marginTop: 8, marginBottom: 5, borderBottomWidth: 0.6, borderBottomColor: C.line, paddingBottom: 2 },
  riskBox: { borderWidth: 1.5, padding: 10, marginBottom: 10 },
  riskTitle: { fontSize: 10, fontWeight: "bold", marginBottom: 4 },
  riskScore: { fontSize: 18, fontWeight: "bold" },
  item: { fontSize: 9, marginBottom: 3, lineHeight: 1.4 },
  mono: { fontSize: 8.5, marginBottom: 4, lineHeight: 1.35 },
  foot: { position: "absolute", bottom: 20, left: 34, right: 34, borderTopWidth: 0.6, borderTopColor: C.line, paddingTop: 5, flexDirection: "row", justifyContent: "space-between" },
  footT: { fontSize: 7, color: C.muted, textTransform: "uppercase" },
});

export type DossieClientePdfData = {
  logoBase64?: string | null;
  cliente: string;
  protocolo: string;
  advogado?: string;
  escritorio?: string;
  tribunal?: string;
  status?: string;
  telefone?: string;
  observacao?: string;
  ultimoRetorno?: string;
  proximoPrazo?: string;
  resumoProcesso: string;
  risco: {
    score: number;
    nivel: string;
    chanceRuim: string;
    drivers: { label: string; pontos: number; severidade: string }[];
  };
  movimentos: { data?: string; nome?: string; complemento?: string }[];
  djen: { data?: string; tipo?: string; texto?: string; link?: string }[];
  geradoEm: string;
};

function riskColor(nivel: string) {
  if (/cr[ií]tico/i.test(nivel)) return C.danger;
  if (/alto/i.test(nivel)) return C.warn;
  if (/moderado/i.test(nivel)) return C.warn;
  return C.ok;
}

export function DossieClientePDF({ data }: { data: DossieClientePdfData }) {
  const rc = riskColor(data.risco.nivel);
  return (
    <Document title={`Dossiê ${data.cliente} ${data.protocolo}`} author="LexisPredict">
      <Page size="A4" style={s.page}>
        <View style={s.brand}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {data.logoBase64 ? (
              <Image src={data.logoBase64} style={s.logo} />
            ) : (
              <View style={{ width: 32, height: 32, backgroundColor: C.brand, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 12 }}>L</Text>
              </View>
            )}
            <View>
              <Text style={s.brandName}>LexisPredict</Text>
              <Text style={s.brandSub}>Dossiê operacional do cliente</Text>
            </View>
          </View>
          <Text style={{ fontSize: 7, fontWeight: "bold", color: C.brand, textTransform: "uppercase" }}>Uso interno</Text>
        </View>

        <Text style={s.title}>Dossiê do processo / cliente</Text>

        <View style={s.box}>
          <View style={s.row}><Text style={s.lab}>Cliente</Text><Text style={s.val}>{data.cliente}</Text></View>
          <View style={s.row}><Text style={s.lab}>CNJ</Text><Text style={s.val}>{data.protocolo}</Text></View>
          <View style={s.row}><Text style={s.lab}>Tribunal</Text><Text style={s.val}>{data.tribunal || "—"}</Text></View>
          <View style={s.row}><Text style={s.lab}>Advogado</Text><Text style={s.val}>{data.advogado || "—"}</Text></View>
          <View style={s.row}><Text style={s.lab}>Escritório</Text><Text style={s.val}>{data.escritorio || "—"}</Text></View>
          <View style={s.row}><Text style={s.lab}>Status carteira</Text><Text style={s.val}>{data.status || "—"}</Text></View>
          <View style={s.row}><Text style={s.lab}>Telefone</Text><Text style={s.val}>{data.telefone || "—"}</Text></View>
          <View style={s.row}><Text style={s.lab}>Último retorno</Text><Text style={s.val}>{data.ultimoRetorno || "—"}</Text></View>
          <View style={s.row}><Text style={s.lab}>Próximo prazo</Text><Text style={s.val}>{data.proximoPrazo || "—"}</Text></View>
        </View>

        <View style={[s.riskBox, { borderColor: rc }]}>
          <Text style={[s.riskTitle, { color: rc }]}>
            Índice de risco: {data.risco.nivel} ({data.risco.score}/100)
          </Text>
          <Text style={{ fontSize: 9, marginBottom: 4 }}>{data.risco.chanceRuim}</Text>
          {data.risco.drivers.map((d, i) => (
            <Text key={i} style={s.item}>
              • [{d.severidade.toUpperCase()}] {d.label} (+{d.pontos})
            </Text>
          ))}
          {data.risco.drivers.length === 0 && (
            <Text style={s.item}>Nenhum fator de risco elevado detectado automaticamente.</Text>
          )}
        </View>

        <Text style={s.h2}>Resumo do processo</Text>
        <Text style={s.item}>{data.resumoProcesso}</Text>

        <Text style={s.h2}>Observações do usuário (CRM)</Text>
        <Text style={s.item}>{data.observacao?.trim() || "Sem observações registradas na carteira."}</Text>

        <Text style={s.h2}>Movimentações do tribunal (DataJud)</Text>
        {data.movimentos.length === 0 ? (
          <Text style={s.item}>Nenhuma movimentação retornada nesta consulta.</Text>
        ) : (
          data.movimentos.slice(0, 40).map((m, i) => (
            <Text key={i} style={s.mono}>
              {m.data || "—"} · {m.nome || "Movimento"}
              {m.complemento ? ` — ${String(m.complemento).slice(0, 180)}` : ""}
            </Text>
          ))
        )}
        {data.movimentos.length > 40 && (
          <Text style={s.item}>… e mais {data.movimentos.length - 40} movimentos (consulta integral no tribunal).</Text>
        )}

        <Text style={s.h2}>Publicações DJEN (desde a consulta)</Text>
        {data.djen.length === 0 ? (
          <Text style={s.item}>Nenhuma comunicação DJEN retornada nesta consulta.</Text>
        ) : (
          data.djen.slice(0, 25).map((d, i) => (
            <View key={i} style={{ marginBottom: 6 }}>
              <Text style={s.mono}>
                {d.data || "—"} · {d.tipo || "Publicação"}
              </Text>
              <Text style={s.item}>{String(d.texto || "").slice(0, 500)}{String(d.texto || "").length > 500 ? "…" : ""}</Text>
            </View>
          ))
        )}

        <Text style={{ fontSize: 7.5, color: C.muted, marginTop: 12, textAlign: "center" }}>
          Documento gerado pelo LexisPredict com dados de DataJud/DJEN e da carteira interna.
          Confira sempre o teor no portal oficial. Não substitui certidão.
        </Text>

        <View style={s.foot} fixed>
          <Text style={s.footT}>LexisPredict · Dossiê cliente</Text>
          <Text style={s.footT}>{data.geradoEm}</Text>
        </View>
      </Page>
    </Document>
  );
}
