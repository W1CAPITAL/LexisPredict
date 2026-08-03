/**
 * Dossiê operacional estratégico do cliente (padrão corporativo LexisPredict)
 */
import React from "react";
import { Page, Text, View, Document, StyleSheet, Image } from "@react-pdf/renderer";

const C = {
  ink: "#0f172a",
  muted: "#64748b",
  line: "#e2e8f0",
  brand: "#0c4a6e",
  soft: "#f1f5f9",
  danger: "#b91c1c",
  warn: "#b45309",
  ok: "#15803d",
  okBg: "#f0fdf4",
  dangerBg: "#fef2f2",
  amberBg: "#fffbeb",
};

const s = StyleSheet.create({
  page: { paddingTop: 26, paddingBottom: 40, paddingHorizontal: 32, fontSize: 9, color: C.ink, fontFamily: "Helvetica" },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10, borderBottomWidth: 1.5, borderBottomColor: C.brand, paddingBottom: 8 },
  brand: { fontSize: 11, fontFamily: "Helvetica-Bold", color: C.brand, letterSpacing: 0.8 },
  brandSub: { fontSize: 7, color: C.muted, marginTop: 2 },
  logo: { width: 28, height: 28 },
  clientName: { fontSize: 14, fontFamily: "Helvetica-Bold", marginTop: 4, marginBottom: 2 },
  metaLine: { fontSize: 8, color: C.muted, marginBottom: 10 },
  grid4: { flexDirection: "row", gap: 6, marginBottom: 8 },
  cell: { flex: 1, backgroundColor: C.soft, borderWidth: 1, borderColor: C.line, padding: 6, minHeight: 42 },
  cellLab: { fontSize: 6.5, color: C.muted, fontFamily: "Helvetica-Bold", textTransform: "uppercase", marginBottom: 3 },
  cellVal: { fontSize: 8.5, fontFamily: "Helvetica-Bold" },
  cellValDanger: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: C.danger },
  grid2: { flexDirection: "row", gap: 8, marginBottom: 10 },
  riskCard: { flex: 1, borderWidth: 1.5, borderColor: C.brand, padding: 10 },
  riskScore: { fontSize: 28, fontFamily: "Helvetica-Bold", color: C.brand },
  riskNivel: { fontSize: 10, fontFamily: "Helvetica-Bold", marginTop: 2 },
  riskHint: { fontSize: 7.5, color: C.muted, marginTop: 6, lineHeight: 1.35 },
  prioCard: { flex: 1.4, backgroundColor: C.soft, borderWidth: 1, borderColor: C.line, padding: 8 },
  prioTitle: { fontSize: 7, fontFamily: "Helvetica-Bold", color: C.muted, textTransform: "uppercase", marginBottom: 6 },
  driverRow: { flexDirection: "row", marginBottom: 4, alignItems: "flex-start" },
  sev: { fontSize: 7, fontFamily: "Helvetica-Bold", width: 36 },
  driverLab: { flex: 1, fontSize: 8 },
  driverPts: { fontSize: 8, fontFamily: "Helvetica-Bold", width: 40, textAlign: "right" },
  h2: { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.brand, marginTop: 8, marginBottom: 5, textTransform: "uppercase" },
  twoCol: { flexDirection: "row", gap: 8, marginBottom: 8 },
  colOk: { flex: 1, backgroundColor: C.okBg, borderWidth: 1, borderColor: "#86efac", padding: 8 },
  colBad: { flex: 1, backgroundColor: C.dangerBg, borderWidth: 1, borderColor: "#fca5a5", padding: 8 },
  colTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", marginBottom: 5 },
  bullet: { fontSize: 7.5, marginBottom: 4, lineHeight: 1.35 },
  timeline: { marginBottom: 8 },
  tlItem: { fontSize: 7.5, marginBottom: 3, lineHeight: 1.3 },
  djenBox: { backgroundColor: C.amberBg, borderWidth: 1, borderColor: "#f59e0b", padding: 8, marginBottom: 8 },
  djenTitle: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: C.warn, marginBottom: 4, textTransform: "uppercase" },
  body: { fontSize: 8.5, lineHeight: 1.45, marginBottom: 6 },
  planItem: { flexDirection: "row", marginBottom: 5 },
  planNum: { width: 14, fontFamily: "Helvetica-Bold", fontSize: 9, color: C.brand },
  planTxt: { flex: 1, fontSize: 8, lineHeight: 1.4 },
  strategy: { backgroundColor: C.soft, borderLeftWidth: 3, borderLeftColor: C.brand, padding: 8, marginTop: 6 },
  foot: { position: "absolute", bottom: 18, left: 32, right: 32, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 0.6, borderTopColor: C.line, paddingTop: 4 },
  footT: { fontSize: 6.5, color: C.muted },
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
  parteContraria?: string;
  resumoProcesso: string;
  risco: {
    score: number;
    nivel: string;
    chanceRuim: string;
    drivers: { label: string; pontos: number; severidade: string }[];
    pontosFortes: string[];
    pontosAtencao: string[];
    planoAcao: string[];
    leituraEstrategica: string;
    faseAtual: string;
  };
  movimentos: { data?: string; nome?: string; complemento?: string }[];
  djen: { data?: string; tipo?: string; texto?: string; link?: string }[];
  geradoEm: string;
};

function sevColor(sev: string) {
  if (sev === "alta") return C.danger;
  if (sev === "media") return C.warn;
  return C.ok;
}

export function DossieClientePDF({ data }: { data: DossieClientePdfData }) {
  const r = data.risco;
  const prazoAtraso = /vencido/i.test(data.status || "");
  const djenDestaque = data.djen[0];
  const movs = data.movimentos.slice(0, 12);

  return (
    <Document title={`Dossiê ${data.cliente}`} author="LexisPredict" subject="Dossiê operacional do cliente">
      <Page size="A4" style={s.page}>
        <View style={s.topBar}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {data.logoBase64 ? <Image src={data.logoBase64} style={s.logo} /> : null}
            <View>
              <Text style={s.brand}>LEXISPREDICT</Text>
              <Text style={s.brandSub}>Dossiê operacional do cliente</Text>
            </View>
          </View>
          <Text style={{ fontSize: 7, color: C.muted }}>Uso interno / confidencial</Text>
        </View>

        <Text style={s.clientName}>{data.cliente}</Text>
        <Text style={s.metaLine}>
          Processo nº {data.protocolo}
          {data.tribunal ? ` | ${data.tribunal}` : ""} | Gerado em {data.geradoEm}
        </Text>

        <View style={s.grid4}>
          <View style={s.cell}>
            <Text style={s.cellLab}>Status da carteira</Text>
            <Text style={prazoAtraso ? s.cellValDanger : s.cellVal}>{data.status || "—"}</Text>
          </View>
          <View style={s.cell}>
            <Text style={s.cellLab}>Fase atual</Text>
            <Text style={s.cellVal}>{r.faseAtual || "—"}</Text>
          </View>
          <View style={s.cell}>
            <Text style={s.cellLab}>Advogado responsável</Text>
            <Text style={s.cellVal}>
              {data.advogado || "—"}
              {data.escritorio ? ` · ${data.escritorio}` : ""}
            </Text>
          </View>
          <View style={s.cell}>
            <Text style={s.cellLab}>Próximo prazo</Text>
            <Text style={prazoAtraso ? s.cellValDanger : s.cellVal}>
              {data.proximoPrazo || "—"}
              {prazoAtraso ? " (em atraso)" : ""}
            </Text>
          </View>
        </View>

        <View style={s.grid4}>
          <View style={s.cell}>
            <Text style={s.cellLab}>Telefone</Text>
            <Text style={s.cellVal}>{data.telefone || "—"}</Text>
          </View>
          <View style={s.cell}>
            <Text style={s.cellLab}>Último retorno</Text>
            <Text style={s.cellVal}>{data.ultimoRetorno || "—"}</Text>
          </View>
          <View style={s.cell}>
            <Text style={s.cellLab}>Tribunal</Text>
            <Text style={s.cellVal}>{data.tribunal || "—"}</Text>
          </View>
          <View style={s.cell}>
            <Text style={s.cellLab}>Parte contrária</Text>
            <Text style={s.cellVal}>{data.parteContraria || "—"}</Text>
          </View>
        </View>

        <View style={s.grid2}>
          <View style={s.riskCard}>
            <Text style={{ fontSize: 7, color: C.muted, fontFamily: "Helvetica-Bold" }}>ÍNDICE DE RISCO</Text>
            <Text style={s.riskScore}>{r.score}</Text>
            <Text style={{ fontSize: 8, color: C.muted }}>de 100</Text>
            <Text style={s.riskNivel}>Nível: {r.nivel}</Text>
            <Text style={s.riskHint}>{r.chanceRuim}</Text>
          </View>
          <View style={s.prioCard}>
            <Text style={s.prioTitle}>Painel de prioridade</Text>
            {(r.drivers || []).slice(0, 5).map((d, i) => (
              <View key={i} style={s.driverRow}>
                <Text style={[s.sev, { color: sevColor(d.severidade) }]}>{d.severidade.toUpperCase()}</Text>
                <Text style={s.driverLab}>{d.label}</Text>
                <Text style={s.driverPts}>+{d.pontos} pts</Text>
              </View>
            ))}
            {(!r.drivers || r.drivers.length === 0) && (
              <Text style={s.bullet}>Sem fatores elevados no momento.</Text>
            )}
          </View>
        </View>

        <Text style={s.h2}>Diagnóstico: pontos fortes e pontos de atenção</Text>
        <View style={s.twoCol}>
          <View style={s.colOk}>
            <Text style={[s.colTitle, { color: C.ok }]}>Pontos fortes</Text>
            {(r.pontosFortes || []).map((t, i) => (
              <Text key={i} style={s.bullet}>
                • {t}
              </Text>
            ))}
          </View>
          <View style={s.colBad}>
            <Text style={[s.colTitle, { color: C.danger }]}>Pontos de atenção</Text>
            {(r.pontosAtencao || []).map((t, i) => (
              <Text key={i} style={s.bullet}>
                • {t}
              </Text>
            ))}
          </View>
        </View>

        <Text style={s.h2}>Linha do tempo processual (DataJud)</Text>
        <View style={s.timeline}>
          {movs.length === 0 ? (
            <Text style={s.bullet}>Nenhuma movimentação retornada nesta consulta.</Text>
          ) : (
            movs.map((m, i) => (
              <Text key={i} style={s.tlItem}>
                {m.data || "—"} · {m.nome || "Movimento"}
                {m.complemento ? ` — ${String(m.complemento).slice(0, 120)}` : ""}
              </Text>
            ))
          )}
        </View>

        {djenDestaque && (
          <View style={s.djenBox}>
            <Text style={s.djenTitle}>
              Publicação DJEN em destaque{djenDestaque.data ? ` · ${djenDestaque.data}` : ""}
            </Text>
            <Text style={s.body}>{String(djenDestaque.texto || "").slice(0, 700)}</Text>
          </View>
        )}

        <View style={s.foot} fixed>
          <Text style={s.footT}>LexisPredict · Dados DataJud/DJEN + carteira — não substitui certidão</Text>
          <Text style={s.footT}>Página 1</Text>
        </View>
      </Page>

      <Page size="A4" style={s.page}>
        <Text style={s.h2}>Resumo executivo</Text>
        <Text style={s.body}>{data.resumoProcesso}</Text>
        {data.observacao ? (
          <Text style={s.body}>Observações do CRM: {data.observacao}</Text>
        ) : null}

        <Text style={s.h2}>Plano de ação recomendado</Text>
        {(r.planoAcao || []).map((t, i) => (
          <View key={i} style={s.planItem}>
            <Text style={s.planNum}>{i + 1}</Text>
            <Text style={s.planTxt}>{t}</Text>
          </View>
        ))}

        <View style={s.strategy}>
          <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", marginBottom: 4, color: C.brand }}>
            LEITURA ESTRATÉGICA
          </Text>
          <Text style={s.body}>{r.leituraEstrategica}</Text>
        </View>

        <View style={s.foot} fixed>
          <Text style={s.footT}>LexisPredict · Dossiê Cliente · {data.geradoEm}</Text>
          <Text style={s.footT}>Página 2</Text>
        </View>
      </Page>
    </Document>
  );
}
