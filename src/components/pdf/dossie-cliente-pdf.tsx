/**
 * Dossiê operacional estratégico — layout premium LexisPredict
 */
import React from "react";
import {
  Page,
  Text,
  View,
  Document,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";

const C = {
  ink: "#0B1220",
  body: "#1e293b",
  muted: "#64748b",
  faint: "#94a3b8",
  line: "#e2e8f0",
  soft: "#f8fafc",
  soft2: "#f1f5f9",
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
};

const s = StyleSheet.create({
  page: {
    paddingTop: 0,
    paddingBottom: 36,
    paddingHorizontal: 0,
    fontSize: 9,
    color: C.body,
    fontFamily: "Helvetica",
    backgroundColor: C.white,
  },
  /* —— header band —— */
  headerBand: {
    backgroundColor: C.brandDark,
    paddingTop: 18,
    paddingBottom: 16,
    paddingHorizontal: 32,
    marginBottom: 0,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logo: { width: 30, height: 30, borderRadius: 4 },
  brandBlock: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandName: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: C.white,
    letterSpacing: 1.2,
  },
  brandSub: {
    fontSize: 7,
    color: "#a5f3fc",
    marginTop: 2,
    letterSpacing: 0.4,
  },
  confBadge: {
    fontSize: 7,
    color: C.white,
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 3,
    letterSpacing: 0.5,
  },
  clientBlock: {
    paddingHorizontal: 32,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: C.soft,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  clientName: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: C.ink,
    marginBottom: 3,
  },
  metaLine: {
    fontSize: 8,
    color: C.muted,
    letterSpacing: 0.2,
  },
  content: {
    paddingHorizontal: 32,
    paddingTop: 14,
  },
  /* —— KPI grid —— */
  kpiRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  kpi: {
    flex: 1,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 4,
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 10,
    paddingRight: 8,
    borderLeftWidth: 3,
    borderLeftColor: C.brand,
  },
  kpiDanger: { borderLeftColor: C.danger },
  kpiLab: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: C.faint,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  kpiVal: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: C.ink,
    lineHeight: 1.25,
  },
  kpiValDanger: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: C.danger,
    lineHeight: 1.25,
  },
  /* —— risk panel —— */
  riskRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
    marginBottom: 12,
  },
  riskGauge: {
    width: 118,
    backgroundColor: C.brandSoft,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#a5f3fc",
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  riskLabel: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: C.brandDark,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  riskNumber: {
    fontSize: 36,
    fontFamily: "Helvetica-Bold",
    color: C.brandDark,
  },
  riskOf: { fontSize: 8, color: C.muted, marginTop: -2 },
  riskNivelPill: {
    marginTop: 8,
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: C.brandDark,
  },
  riskNivelText: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: C.white,
    letterSpacing: 0.4,
  },
  prioPanel: {
    flex: 1,
    backgroundColor: C.soft,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.line,
    padding: 10,
  },
  prioTitle: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: C.muted,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  driverRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    paddingBottom: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: C.line,
  },
  sevPill: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    paddingVertical: 2,
    paddingHorizontal: 5,
    borderRadius: 3,
    marginRight: 6,
    width: 38,
    textAlign: "center",
  },
  driverLab: { flex: 1, fontSize: 8, color: C.body },
  driverPts: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: C.brandDark,
    width: 42,
    textAlign: "right",
  },
  riskHint: {
    fontSize: 7.5,
    color: C.muted,
    lineHeight: 1.4,
    marginTop: 4,
  },
  /* —— section title —— */
  h2: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: C.brandDark,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginTop: 4,
    marginBottom: 7,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  /* —— diagnosis —— */
  diagRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  colOk: {
    flex: 1,
    backgroundColor: C.okSoft,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#6ee7b7",
    padding: 9,
  },
  colBad: {
    flex: 1,
    backgroundColor: C.dangerSoft,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#fca5a5",
    padding: 9,
  },
  colTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  bullet: {
    fontSize: 7.5,
    lineHeight: 1.4,
    marginBottom: 5,
    color: C.body,
  },
  /* —— timeline —— */
  tlRow: {
    flexDirection: "row",
    marginBottom: 5,
    alignItems: "flex-start",
  },
  tlDotCol: { width: 14, alignItems: "center", paddingTop: 2 },
  tlDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.brand,
  },
  tlDate: {
    width: 72,
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: C.brandDark,
  },
  tlBody: { flex: 1, fontSize: 7.5, lineHeight: 1.35, color: C.body },
  /* —— DJEN highlight —— */
  djenBox: {
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: C.warnSoft,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#fbbf24",
    borderLeftWidth: 3,
    borderLeftColor: C.warn,
    padding: 10,
  },
  djenTitle: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: C.warn,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 5,
  },
  djenBody: { fontSize: 8, lineHeight: 1.45, color: C.body },
  /* —— page 2 —— */
  page2Header: {
    backgroundColor: C.brandDark,
    height: 8,
    marginBottom: 18,
  },
  execBox: {
    backgroundColor: C.soft,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: C.line,
    padding: 12,
    marginBottom: 12,
  },
  execText: { fontSize: 8.5, lineHeight: 1.5, color: C.body },
  planCard: {
    flexDirection: "row",
    marginBottom: 8,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 5,
    overflow: "hidden",
  },
  planNumBox: {
    width: 28,
    backgroundColor: C.brandDark,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  planNum: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: C.white,
  },
  planBody: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  planTxt: { fontSize: 8.5, lineHeight: 1.4, color: C.body },
  strategyBox: {
    marginTop: 10,
    backgroundColor: C.brandSoft,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#67e8f9",
    padding: 12,
  },
  strategyTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: C.brandDark,
    letterSpacing: 0.8,
    marginBottom: 5,
  },
  strategyText: { fontSize: 8.5, lineHeight: 1.5, color: C.body },
  obsBox: {
    marginTop: 8,
    padding: 8,
    backgroundColor: C.soft2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: C.line,
  },
  foot: {
    position: "absolute",
    bottom: 14,
    left: 32,
    right: 32,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.8,
    borderTopColor: C.line,
    paddingTop: 6,
  },
  footT: { fontSize: 6.5, color: C.faint },
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

function sevStyle(sev: string) {
  if (sev === "alta") {
    return { backgroundColor: C.dangerSoft, color: C.danger };
  }
  if (sev === "media") {
    return { backgroundColor: C.warnSoft, color: C.warn };
  }
  return { backgroundColor: C.okSoft, color: C.ok };
}

function nivelColor(nivel: string) {
  if (/cr[ií]tico/i.test(nivel)) return C.danger;
  if (/alto/i.test(nivel)) return C.warn;
  if (/moderado/i.test(nivel)) return C.brandDark;
  return C.ok;
}

function fmtShortDate(raw?: string) {
  if (!raw) return "—";
  const s = String(raw);
  // ISO or datetime → dd/mm
  const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}`;
  const br = s.match(/(\d{2})\/(\d{2})\/(\d{2,4})/);
  if (br) return `${br[1]}/${br[2]}`;
  return s.slice(0, 10);
}

export function DossieClientePDF({ data }: { data: DossieClientePdfData }) {
  const r = data.risco;
  const prazoAtraso = /vencido/i.test(data.status || "");
  const djenDestaque = (data.djen || []).find((d) => (d.texto || "").length > 40) || data.djen?.[0];
  const movs = (data.movimentos || []).slice(0, 10);
  const nc = nivelColor(r.nivel || "");

  return (
    <Document
      title={`Dossiê ${data.cliente}`}
      author="LexisPredict"
      subject="Dossiê operacional estratégico do cliente"
    >
      {/* ================= PAGE 1 ================= */}
      <Page size="A4" style={s.page}>
        <View style={s.headerBand}>
          <View style={s.headerRow}>
            <View style={s.brandBlock}>
              {data.logoBase64 ? (
                <Image src={data.logoBase64} style={s.logo} />
              ) : (
                <View
                  style={{
                    width: 30,
                    height: 30,
                    backgroundColor: C.brand,
                    borderRadius: 4,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: C.white, fontFamily: "Helvetica-Bold", fontSize: 14 }}>L</Text>
                </View>
              )}
              <View>
                <Text style={s.brandName}>LEXISPREDICT</Text>
                <Text style={s.brandSub}>DOSSIÊ OPERACIONAL DO CLIENTE</Text>
              </View>
            </View>
            <Text style={s.confBadge}>USO INTERNO · CONFIDENCIAL</Text>
          </View>
        </View>

        <View style={s.clientBlock}>
          <Text style={s.clientName}>{data.cliente}</Text>
          <Text style={s.metaLine}>
            Processo nº {data.protocolo}
            {data.tribunal ? `  ·  ${data.tribunal}` : ""}
            {"  ·  "}
            {data.geradoEm}
          </Text>
        </View>

        <View style={s.content}>
          {/* KPIs row 1 */}
          <View style={s.kpiRow}>
            <View style={[s.kpi, prazoAtraso ? s.kpiDanger : {}]}>
              <Text style={s.kpiLab}>Status da carteira</Text>
              <Text style={prazoAtraso ? s.kpiValDanger : s.kpiVal}>
                {data.status || "—"}
              </Text>
            </View>
            <View style={s.kpi}>
              <Text style={s.kpiLab}>Fase atual</Text>
              <Text style={s.kpiVal}>{r.faseAtual || "—"}</Text>
            </View>
            <View style={s.kpi}>
              <Text style={s.kpiLab}>Advogado responsável</Text>
              <Text style={s.kpiVal}>
                {data.advogado || "—"}
                {data.escritorio ? `\n${data.escritorio}` : ""}
              </Text>
            </View>
            <View style={[s.kpi, prazoAtraso ? s.kpiDanger : {}]}>
              <Text style={s.kpiLab}>Próximo prazo</Text>
              <Text style={prazoAtraso ? s.kpiValDanger : s.kpiVal}>
                {data.proximoPrazo || "—"}
                {prazoAtraso ? " · em atraso" : ""}
              </Text>
            </View>
          </View>

          {/* KPIs row 2 */}
          <View style={s.kpiRow}>
            <View style={s.kpi}>
              <Text style={s.kpiLab}>Telefone</Text>
              <Text style={s.kpiVal}>{data.telefone || "—"}</Text>
            </View>
            <View style={s.kpi}>
              <Text style={s.kpiLab}>Último retorno</Text>
              <Text style={s.kpiVal}>{data.ultimoRetorno || "—"}</Text>
            </View>
            <View style={s.kpi}>
              <Text style={s.kpiLab}>Tribunal</Text>
              <Text style={s.kpiVal}>{data.tribunal || "—"}</Text>
            </View>
            <View style={s.kpi}>
              <Text style={s.kpiLab}>Parte contrária</Text>
              <Text style={s.kpiVal}>{data.parteContraria || "—"}</Text>
            </View>
          </View>

          {/* Risk + priority */}
          <View style={s.riskRow}>
            <View style={s.riskGauge}>
              <Text style={s.riskLabel}>ÍNDICE DE RISCO</Text>
              <Text style={[s.riskNumber, { color: nc }]}>{r.score ?? 0}</Text>
              <Text style={s.riskOf}>de 100</Text>
              <View style={[s.riskNivelPill, { backgroundColor: nc }]}>
                <Text style={s.riskNivelText}>{(r.nivel || "—").toUpperCase()}</Text>
              </View>
            </View>

            <View style={s.prioPanel}>
              <Text style={s.prioTitle}>Painel de prioridade</Text>
              {(r.drivers || []).slice(0, 5).map((d, i) => {
                const st = sevStyle(d.severidade);
                return (
                  <View key={i} style={s.driverRow}>
                    <Text style={[s.sevPill, st]}>{(d.severidade || "").toUpperCase()}</Text>
                    <Text style={s.driverLab}>{d.label}</Text>
                    <Text style={s.driverPts}>+{d.pontos}</Text>
                  </View>
                );
              })}
              {(!r.drivers || r.drivers.length === 0) && (
                <Text style={s.bullet}>Sem fatores elevados no momento.</Text>
              )}
              <Text style={s.riskHint}>{r.chanceRuim}</Text>
            </View>
          </View>

          {/* Diagnosis */}
          <Text style={s.h2}>Diagnóstico — pontos fortes e pontos de atenção</Text>
          <View style={s.diagRow}>
            <View style={s.colOk}>
              <Text style={[s.colTitle, { color: C.ok }]}>Pontos fortes</Text>
              {(r.pontosFortes || []).map((t, i) => (
                <Text key={i} style={s.bullet}>
                  •  {t}
                </Text>
              ))}
            </View>
            <View style={s.colBad}>
              <Text style={[s.colTitle, { color: C.danger }]}>Pontos de atenção</Text>
              {(r.pontosAtencao || []).map((t, i) => (
                <Text key={i} style={s.bullet}>
                  •  {t}
                </Text>
              ))}
            </View>
          </View>

          {/* Timeline */}
          <Text style={s.h2}>Linha do tempo processual (DataJud)</Text>
          {movs.length === 0 ? (
            <Text style={s.bullet}>Nenhuma movimentação retornada nesta consulta.</Text>
          ) : (
            movs.map((m, i) => (
              <View key={i} style={s.tlRow}>
                <View style={s.tlDotCol}>
                  <View style={s.tlDot} />
                </View>
                <Text style={s.tlDate}>{fmtShortDate(m.data)}</Text>
                <Text style={s.tlBody}>
                  {m.nome || "Movimento"}
                  {m.complemento ? ` — ${String(m.complemento).slice(0, 110)}` : ""}
                </Text>
              </View>
            ))
          )}

          {/* DJEN */}
          {djenDestaque && (
            <View style={s.djenBox}>
              <Text style={s.djenTitle}>
                Publicação DJEN em destaque
                {djenDestaque.data ? `  ·  ${djenDestaque.data}` : ""}
              </Text>
              <Text style={s.djenBody}>
                {String(djenDestaque.texto || "").slice(0, 650)}
                {String(djenDestaque.texto || "").length > 650 ? "…" : ""}
              </Text>
            </View>
          )}
        </View>

        <View style={s.foot} fixed>
          <Text style={s.footT}>
            LexisPredict · DataJud/DJEN + carteira interna — não substitui certidão oficial
          </Text>
          <Text style={s.footT}>Página 1 de 2</Text>
        </View>
      </Page>

      {/* ================= PAGE 2 ================= */}
      <Page size="A4" style={s.page}>
        <View style={s.page2Header} />
        <View style={s.content}>
          <Text style={[s.clientName, { fontSize: 12, marginBottom: 2 }]}>
            {data.cliente}
          </Text>
          <Text style={[s.metaLine, { marginBottom: 12 }]}>
            {data.protocolo} · Continuação do dossiê operacional
          </Text>

          <Text style={s.h2}>Resumo executivo</Text>
          <View style={s.execBox}>
            <Text style={s.execText}>{data.resumoProcesso}</Text>
          </View>

          {data.observacao ? (
            <View style={s.obsBox}>
              <Text style={[s.kpiLab, { marginBottom: 3 }]}>Observações do CRM</Text>
              <Text style={s.execText}>{data.observacao}</Text>
            </View>
          ) : null}

          <Text style={[s.h2, { marginTop: 12 }]}>Plano de ação recomendado</Text>
          {(r.planoAcao || []).map((t, i) => (
            <View key={i} style={s.planCard} wrap={false}>
              <View style={s.planNumBox}>
                <Text style={s.planNum}>{i + 1}</Text>
              </View>
              <View style={s.planBody}>
                <Text style={s.planTxt}>{t}</Text>
              </View>
            </View>
          ))}

          <View style={s.strategyBox} wrap={false}>
            <Text style={s.strategyTitle}>LEITURA ESTRATÉGICA</Text>
            <Text style={s.strategyText}>{r.leituraEstrategica}</Text>
          </View>
        </View>

        <View style={s.foot} fixed>
          <Text style={s.footT}>
            LexisPredict · Dossiê Cliente · {data.geradoEm}
          </Text>
          <Text style={s.footT}>Página 2 de 2</Text>
        </View>
      </Page>
    </Document>
  );
}
