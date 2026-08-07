/**
 * Dossiê operacional estratégico — layout premium LexisPredict
 *
 * Changelog desta revisão:
 * - FIX: texto do DJEN chegava com entidades HTML não decodificadas
 *   (&agrave; / &ecirc; / &ocirc; apareciam literalmente). Agora passa
 *   por decodeHtmlEntities() antes de renderizar.
 * - FIX: rodapé "Página X de Y" era hardcoded (sempre "1 de 2" / "2 de 2").
 *   Agora usa o render-prop do react-pdf para contar páginas de verdade —
 *   importante se o conteúdo crescer e quebrar em 3+ páginas.
 * - FIX: "em atraso" era um texto estático amarrado à regex de status.
 *   Agora calcula os dias reais de atraso a partir de proximoPrazo x geradoEm.
 * - Refactor: componente monolítico quebrado em subcomponentes
 *   (KpiCard, RiskGauge, PriorityPanel, TimelineItem, DjenHighlight, PlanCard).
 * - Robustez: normalização de severidade (acentos/caixa), overflow de
 *   movimentações tratado explicitamente em vez de cortar em 10 silenciosamente.
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

// ————————————————————————————————————————————————————————————
// Design tokens
// ————————————————————————————————————————————————————————————

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
} as const;

type Severidade = "alta" | "media" | "baixa";

const MAX_MOVIMENTOS_EXIBIDOS = 8;
const MAX_CHARS_DJEN = 650;

// ————————————————————————————————————————————————————————————
// Estilos
// ————————————————————————————————————————————————————————————

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
  headerBand: {
    backgroundColor: C.brandDark,
    paddingTop: 18,
    paddingBottom: 16,
    paddingHorizontal: 32,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logo: { width: 30, height: 30, borderRadius: 4 },
  logoFallback: {
    width: 30,
    height: 30,
    backgroundColor: C.brand,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  logoFallbackTxt: { color: C.white, fontFamily: "Helvetica-Bold", fontSize: 14 },
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
  tlMore: {
    fontSize: 7.5,
    color: C.muted,
    marginTop: 2,
    marginLeft: 14,
    fontFamily: "Helvetica-Oblique",
  },
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

// ————————————————————————————————————————————————————————————
// Tipos públicos
// ————————————————————————————————————————————————————————————

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

// ————————————————————————————————————————————————————————————
// Helpers
// ————————————————————————————————————————————————————————————

/**
 * Decodifica as entidades HTML nomeadas mais comuns em publicações
 * jurídicas em pt-BR (acentuação, cedilha). O texto vindo de DJEN
 * frequentemente chega pré-escapado (&agrave;, &ecirc; etc.) e, sem
 * isso, aparece literalmente no PDF.
 */
function decodeHtmlEntities(input?: string): string {
  if (!input) return "";
  const map: Record<string, string> = {
    "&agrave;": "à", "&Agrave;": "À",
    "&aacute;": "á", "&Aacute;": "Á",
    "&acirc;": "â", "&Acirc;": "Â",
    "&atilde;": "ã", "&Atilde;": "Ã",
    "&eacute;": "é", "&Eacute;": "É",
    "&ecirc;": "ê", "&Ecirc;": "Ê",
    "&iacute;": "í", "&Iacute;": "Í",
    "&oacute;": "ó", "&Oacute;": "Ó",
    "&ocirc;": "ô", "&Ocirc;": "Ô",
    "&otilde;": "õ", "&Otilde;": "Õ",
    "&uacute;": "ú", "&Uacute;": "Ú",
    "&ccedil;": "ç", "&Ccedil;": "Ç",
    "&amp;": "&",
    "&nbsp;": " ",
    "&quot;": '"',
    "&#39;": "'",
    "&lt;": "<",
    "&gt;": ">",
  };
  let out = input;
  for (const [entity, char] of Object.entries(map)) {
    out = out.split(entity).join(char);
  }
  // fallback genérico para entidades numéricas (&#123;)
  out = out.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
  return out;
}

function normalizeSeveridade(sev: string): Severidade {
  const n = (sev || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (n.startsWith("alt")) return "alta";
  if (n.startsWith("med")) return "media";
  return "baixa";
}

function sevStyle(sev: string): { backgroundColor: string; color: string } {
  switch (normalizeSeveridade(sev)) {
    case "alta":
      return { backgroundColor: C.dangerSoft, color: C.danger };
    case "media":
      return { backgroundColor: C.warnSoft, color: C.warn };
    default:
      return { backgroundColor: C.okSoft, color: C.ok };
  }
}

function nivelColor(nivel: string): string {
  const n = (nivel || "").toLowerCase();
  if (n.includes("crit")) return C.danger;
  if (n.includes("alt")) return C.warn;
  if (n.includes("moder")) return C.brandDark;
  return C.ok;
}

function fmtShortDate(raw?: string): string {
  if (!raw) return "—";
  const str = String(raw);
  const iso = str.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}`;
  const br = str.match(/(\d{2})\/(\d{2})\/(\d{2,4})/);
  if (br) return `${br[1]}/${br[2]}`;
  return str.slice(0, 10);
}

/** Extrai só a data (YYYY-MM-DD) de uma string ISO ou dd/mm/aaaa, para diffs seguros. */
function parseDateOnly(raw?: string): Date | null {
  if (!raw) return null;
  const iso = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const br = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
  return null;
}

/** Dias de atraso entre o prazo e a data de geração do relatório (>0 = atrasado). */
function diasEmAtraso(proximoPrazo?: string, geradoEm?: string): number | null {
  const prazo = parseDateOnly(proximoPrazo);
  const geracao = parseDateOnly(geradoEm);
  if (!prazo || !geracao) return null;
  const diffMs = geracao.getTime() - prazo.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function truncate(text: string, max: number): string {
  const clean = text.trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

// ————————————————————————————————————————————————————————————
// Subcomponentes
// ————————————————————————————————————————————————————————————

function KpiCard({
  label,
  value,
  danger,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <View style={[s.kpi, danger ? s.kpiDanger : {}]}>
      <Text style={s.kpiLab}>{label}</Text>
      <Text style={danger ? s.kpiValDanger : s.kpiVal}>{value || "—"}</Text>
    </View>
  );
}

function RiskGauge({ score, nivel }: { score: number; nivel: string }) {
  const nc = nivelColor(nivel);
  return (
    <View style={s.riskGauge}>
      <Text style={s.riskLabel}>ÍNDICE DE RISCO</Text>
      <Text style={[s.riskNumber, { color: nc }]}>{score ?? 0}</Text>
      <Text style={s.riskOf}>de 100</Text>
      <View style={[s.riskNivelPill, { backgroundColor: nc }]}>
        <Text style={s.riskNivelText}>{(nivel || "—").toUpperCase()}</Text>
      </View>
    </View>
  );
}

function PriorityPanel({
  drivers,
  hint,
}: {
  drivers: { label: string; pontos: number; severidade: string }[];
  hint: string;
}) {
  return (
    <View style={s.prioPanel}>
      <Text style={s.prioTitle}>Painel de prioridade</Text>
      {drivers.length === 0 ? (
        <Text style={s.bullet}>Sem fatores elevados no momento.</Text>
      ) : (
        drivers.slice(0, 5).map((d, i) => {
          const st = sevStyle(d.severidade);
          return (
            <View key={i} style={s.driverRow}>
              <Text style={[s.sevPill, st]}>{normalizeSeveridade(d.severidade).toUpperCase()}</Text>
              <Text style={s.driverLab}>{d.label}</Text>
              <Text style={s.driverPts}>+{d.pontos}</Text>
            </View>
          );
        })
      )}
      <Text style={s.riskHint}>{hint}</Text>
    </View>
  );
}

function TimelineItem({ data, nome, complemento }: { data?: string; nome?: string; complemento?: string }) {
  return (
    <View style={s.tlRow}>
      <View style={s.tlDotCol}>
        <View style={s.tlDot} />
      </View>
      <Text style={s.tlDate}>{fmtShortDate(data)}</Text>
      <Text style={s.tlBody}>
        {nome || "Movimento"}
        {complemento ? ` — ${truncate(decodeHtmlEntities(complemento), 110)}` : ""}
      </Text>
    </View>
  );
}

function DjenHighlight({ data, texto }: { data?: string; texto?: string }) {
  if (!texto) return null;
  const decoded = decodeHtmlEntities(texto);
  return (
    <View style={s.djenBox} wrap={false}>
      <Text style={s.djenTitle}>
        Publicação DJEN em destaque{data ? `  ·  ${data}` : ""}
      </Text>
      <Text style={s.djenBody}>{truncate(decoded, MAX_CHARS_DJEN)}</Text>
    </View>
  );
}

function PlanCard({ index, text }: { index: number; text: string }) {
  return (
    <View style={s.planCard} wrap={false}>
      <View style={s.planNumBox}>
        <Text style={s.planNum}>{index + 1}</Text>
      </View>
      <View style={s.planBody}>
        <Text style={s.planTxt}>{text}</Text>
      </View>
    </View>
  );
}

function BrandHeader({ logoBase64 }: { logoBase64?: string | null }) {
  return (
    <View style={s.headerBand}>
      <View style={s.headerRow}>
        <View style={s.brandBlock}>
          {logoBase64 ? (
            <Image src={logoBase64} style={s.logo} />
          ) : (
            <View style={s.logoFallback}>
              <Text style={s.logoFallbackTxt}>L</Text>
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
  );
}

function Footer({ left }: { left: string }) {
  return (
    <View style={s.foot} fixed>
      <Text style={s.footT}>{left}</Text>
      <Text
        style={s.footT}
        render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
      />
    </View>
  );
}

// ————————————————————————————————————————————————————————————
// Documento principal
// ————————————————————————————————————————————————————————————

export function DossieClientePDF({ data }: { data: DossieClientePdfData }) {
  const r = data.risco;
  const atrasoDias = diasEmAtraso(data.proximoPrazo, data.geradoEm);
  const prazoAtrasado = (atrasoDias !== null && atrasoDias > 0) || /vencido/i.test(data.status || "");

  const movimentos = data.movimentos || [];
  const movsExibidos = movimentos.slice(0, MAX_MOVIMENTOS_EXIBIDOS);
  const movsRestantes = movimentos.length - movsExibidos.length;

  const djenDestaque =
    (data.djen || []).find((d) => (d.texto || "").length > 40) || data.djen?.[0];

  const footerLabel = "LexisPredict · DataJud/DJEN + carteira interna — não substitui certidão oficial";

  return (
    <Document
      title={`Dossiê ${data.cliente}`}
      author="LexisPredict"
      subject="Dossiê operacional estratégico do cliente"
    >
      {/* ================= PÁGINA 1 ================= */}
      <Page size="A4" style={s.page}>
        <BrandHeader logoBase64={data.logoBase64} />

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
          <View style={s.kpiRow}>
            <KpiCard label="Status da carteira" value={data.status || "—"} danger={prazoAtrasado} />
            <KpiCard label="Fase atual" value={r.faseAtual || "—"} />
            <KpiCard
              label="Advogado responsável"
              value={[data.advogado, data.escritorio].filter(Boolean).join("\n")}
            />
            <KpiCard
              label="Próximo prazo"
              value={
                data.proximoPrazo
                  ? `${data.proximoPrazo}${
                      atrasoDias && atrasoDias > 0
                        ? ` · ${atrasoDias} dia${atrasoDias === 1 ? "" : "s"} em atraso`
                        : ""
                    }`
                  : "—"
              }
              danger={prazoAtrasado}
            />
          </View>

          <View style={s.kpiRow}>
            <KpiCard label="Telefone" value={data.telefone || "—"} />
            <KpiCard label="Último retorno" value={data.ultimoRetorno || "—"} />
            <KpiCard label="Tribunal" value={data.tribunal || "—"} />
            <KpiCard label="Parte contrária" value={data.parteContraria || "—"} />
          </View>

          <View style={s.riskRow}>
            <RiskGauge score={r.score} nivel={r.nivel} />
            <PriorityPanel drivers={r.drivers || []} hint={r.chanceRuim} />
          </View>

          <Text style={s.h2}>Diagnóstico — pontos fortes e pontos de atenção</Text>
          <View style={s.diagRow}>
            <View style={s.colOk}>
              <Text style={[s.colTitle, { color: C.ok }]}>Pontos fortes</Text>
              {(r.pontosFortes || []).map((t, i) => (
                <Text key={i} style={s.bullet}>•  {t}</Text>
              ))}
            </View>
            <View style={s.colBad}>
              <Text style={[s.colTitle, { color: C.danger }]}>Pontos de atenção</Text>
              {(r.pontosAtencao || []).map((t, i) => (
                <Text key={i} style={s.bullet}>•  {t}</Text>
              ))}
            </View>
          </View>

          <Text style={s.h2}>Linha do tempo processual (DataJud)</Text>
          {movsExibidos.length === 0 ? (
            <Text style={s.bullet}>Nenhuma movimentação retornada nesta consulta.</Text>
          ) : (
            <>
              {movsExibidos.map((m, i) => (
                <TimelineItem key={i} data={m.data} nome={m.nome} complemento={m.complemento} />
              ))}
              {movsRestantes > 0 && (
                <Text style={s.tlMore}>
                  + {movsRestantes} movimentação{movsRestantes === 1 ? "" : "ões"} anterior
                  {movsRestantes === 1 ? "" : "es"} disponível{movsRestantes === 1 ? "" : "eis"} na consulta completa.
                </Text>
              )}
            </>
          )}

          {djenDestaque && <DjenHighlight data={djenDestaque.data} texto={djenDestaque.texto} />}
        </View>

        <Footer left={footerLabel} />
      </Page>

      {/* ================= PÁGINA 2 ================= */}
      <Page size="A4" style={s.page}>
        <View style={s.page2Header} />
        <View style={s.content}>
          <Text style={[s.clientName, { fontSize: 12, marginBottom: 2 }]}>{data.cliente}</Text>
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
            <PlanCard key={i} index={i} text={t} />
          ))}

          <View style={s.strategyBox} wrap={false}>
            <Text style={s.strategyTitle}>LEITURA ESTRATÉGICA</Text>
            <Text style={s.strategyText}>{r.leituraEstrategica}</Text>
          </View>
        </View>

        <Footer left={`LexisPredict · Dossiê Cliente · ${data.geradoEm}`} />
      </Page>
    </Document>
  );
}
