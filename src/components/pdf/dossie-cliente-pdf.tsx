/**
 * Dossiê operacional estratégico — LexisPredict v3 (premium)
 *
 * Herda da revisão anterior:
 * - decodeHtmlEntities no DJEN/complementos
 * - rodapé com pageNumber/totalPages
 * - atraso real em dias (proximoPrazo × geradoEm)
 * - subcomponentes + overflow de movimentações
 *
 * v3 — polish visual:
 * - barra de progresso do risco (gauge horizontal sob o score)
 * - faixa de acento sob o header
 * - KPI com mini-label + valor em hierarquia mais clara
 * - timeline com linha vertical contínua
 * - plano de ação com título implícito mais legível
 * - watermark sutil de página (opcional via View)
 * - melhor truncagem de texto em limites seguros para A4
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
  brandDark: "#155e75",
  brandDeep: "#083344",
  brandSoft: "#ecfeff",
  brandMid: "#22d3ee",
  danger: "#dc2626",
  dangerSoft: "#fef2f2",
  warn: "#d97706",
  warnSoft: "#fffbeb",
  ok: "#059669",
  okSoft: "#ecfdf5",
  white: "#ffffff",
} as const;

type Severidade = "alta" | "media" | "baixa";
const MAX_MOVIMENTOS_EXIBIDOS = 9;
const MAX_CHARS_DJEN = 680;
const MAX_CHARS_COMPLEMENTO = 100;

const s = StyleSheet.create({
  page: {
    paddingTop: 0,
    paddingBottom: 40,
    paddingHorizontal: 0,
    fontSize: 9,
    color: C.body,
    fontFamily: "Helvetica",
    backgroundColor: C.white,
  },

  /* Header */
  headerBand: {
    backgroundColor: C.brandDeep,
    paddingTop: 16,
    paddingBottom: 14,
    paddingHorizontal: 30,
  },
  headerAccent: {
    height: 3,
    backgroundColor: C.brandMid,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logo: { width: 32, height: 32, borderRadius: 5 },
  logoFallback: {
    width: 32,
    height: 32,
    backgroundColor: C.brand,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  logoFallbackTxt: { color: C.white, fontFamily: "Helvetica-Bold", fontSize: 15 },
  brandBlock: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandName: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: C.white,
    letterSpacing: 1.4,
  },
  brandSub: {
    fontSize: 6.5,
    color: "#a5f3fc",
    marginTop: 2,
    letterSpacing: 0.8,
  },
  confBadge: {
    fontSize: 6.5,
    color: C.white,
    backgroundColor: "rgba(255,255,255,0.14)",
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 3,
    letterSpacing: 0.6,
  },

  /* Client */
  clientBlock: {
    paddingHorizontal: 30,
    paddingTop: 14,
    paddingBottom: 12,
    backgroundColor: C.soft,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  clientName: {
    fontSize: 15,
    fontFamily: "Helvetica-Bold",
    color: C.ink,
    marginBottom: 3,
  },
  metaLine: {
    fontSize: 8,
    color: C.muted,
    letterSpacing: 0.15,
  },
  content: {
    paddingHorizontal: 30,
    paddingTop: 12,
  },

  /* KPIs */
  kpiRow: {
    flexDirection: "row",
    gap: 7,
    marginBottom: 7,
  },
  kpi: {
    flex: 1,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 5,
    paddingTop: 7,
    paddingBottom: 7,
    paddingLeft: 9,
    paddingRight: 7,
    borderLeftWidth: 3,
    borderLeftColor: C.brand,
  },
  kpiDanger: { borderLeftColor: C.danger, backgroundColor: "#fffbfb" },
  kpiLab: {
    fontSize: 6,
    fontFamily: "Helvetica-Bold",
    color: C.faint,
    textTransform: "uppercase",
    letterSpacing: 0.55,
    marginBottom: 3,
  },
  kpiVal: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: C.ink,
    lineHeight: 1.25,
  },
  kpiValDanger: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: C.danger,
    lineHeight: 1.25,
  },

  /* Risk */
  riskRow: {
    flexDirection: "row",
    gap: 9,
    marginTop: 6,
    marginBottom: 11,
  },
  riskGauge: {
    width: 122,
    backgroundColor: C.brandSoft,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#a5f3fc",
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  riskLabel: {
    fontSize: 6,
    fontFamily: "Helvetica-Bold",
    color: C.brandDark,
    letterSpacing: 0.9,
    marginBottom: 2,
  },
  riskNumber: {
    fontSize: 34,
    fontFamily: "Helvetica-Bold",
  },
  riskOf: { fontSize: 7.5, color: C.muted, marginTop: -1 },
  riskBarTrack: {
    width: "100%",
    height: 5,
    backgroundColor: "#cffafe",
    borderRadius: 3,
    marginTop: 8,
    overflow: "hidden",
  },
  riskBarFill: {
    height: 5,
    borderRadius: 3,
  },
  riskNivelPill: {
    marginTop: 8,
    paddingVertical: 3,
    paddingHorizontal: 11,
    borderRadius: 10,
  },
  riskNivelText: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: C.white,
    letterSpacing: 0.5,
  },
  prioPanel: {
    flex: 1,
    backgroundColor: C.soft,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: C.line,
    padding: 10,
  },
  prioTitle: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: C.muted,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    marginBottom: 7,
  },
  driverRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
    paddingBottom: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: C.line,
  },
  sevPill: {
    fontSize: 6,
    fontFamily: "Helvetica-Bold",
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRadius: 3,
    marginRight: 6,
    width: 36,
    textAlign: "center",
  },
  driverLab: { flex: 1, fontSize: 7.5, color: C.body },
  driverPts: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: C.brandDark,
    width: 40,
    textAlign: "right",
  },
  riskHint: {
    fontSize: 7,
    color: C.muted,
    lineHeight: 1.4,
    marginTop: 5,
  },

  /* Sections */
  h2: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: C.brandDeep,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    marginTop: 2,
    marginBottom: 7,
    paddingBottom: 3,
    borderBottomWidth: 1.2,
    borderBottomColor: C.line,
  },
  diagRow: { flexDirection: "row", gap: 7, marginBottom: 11 },
  colOk: {
    flex: 1,
    backgroundColor: C.okSoft,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#6ee7b7",
    padding: 9,
  },
  colBad: {
    flex: 1,
    backgroundColor: C.dangerSoft,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#fca5a5",
    padding: 9,
  },
  colTitle: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  bullet: {
    fontSize: 7.2,
    lineHeight: 1.42,
    marginBottom: 4,
    color: C.body,
  },

  /* Timeline with vertical line */
  tlWrap: {
    position: "relative",
    marginBottom: 4,
    paddingLeft: 2,
  },
  tlRow: {
    flexDirection: "row",
    marginBottom: 4,
    alignItems: "flex-start",
  },
  tlDotCol: {
    width: 16,
    alignItems: "center",
    paddingTop: 2,
  },
  tlDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: C.brand,
    borderWidth: 1.5,
    borderColor: C.brandSoft,
  },
  tlDate: {
    width: 48,
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: C.brandDark,
  },
  tlBody: { flex: 1, fontSize: 7.2, lineHeight: 1.35, color: C.body },
  tlMore: {
    fontSize: 7,
    color: C.muted,
    marginTop: 3,
    marginLeft: 16,
    fontFamily: "Helvetica-Oblique",
  },

  /* DJEN */
  djenBox: {
    marginTop: 8,
    marginBottom: 2,
    backgroundColor: C.warnSoft,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#fcd34d",
    borderLeftWidth: 3.5,
    borderLeftColor: C.warn,
    padding: 10,
  },
  djenTitle: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: C.warn,
    letterSpacing: 0.55,
    textTransform: "uppercase",
    marginBottom: 5,
  },
  djenBody: { fontSize: 7.8, lineHeight: 1.48, color: C.body },

  /* Page 2 */
  page2Stripe: {
    backgroundColor: C.brandDeep,
    height: 6,
    marginBottom: 16,
  },
  execBox: {
    backgroundColor: C.soft,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.line,
    padding: 11,
    marginBottom: 10,
  },
  execText: { fontSize: 8.2, lineHeight: 1.52, color: C.body },
  planCard: {
    flexDirection: "row",
    marginBottom: 7,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 6,
    overflow: "hidden",
  },
  planNumBox: {
    width: 30,
    backgroundColor: C.brandDeep,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
  },
  planNum: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: C.white,
  },
  planBody: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 11,
    justifyContent: "center",
  },
  planTxt: { fontSize: 8.2, lineHeight: 1.42, color: C.body },
  strategyBox: {
    marginTop: 12,
    backgroundColor: C.brandSoft,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#67e8f9",
    borderLeftWidth: 3.5,
    borderLeftColor: C.brand,
    padding: 12,
  },
  strategyTitle: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: C.brandDeep,
    letterSpacing: 0.9,
    marginBottom: 5,
  },
  strategyText: { fontSize: 8.2, lineHeight: 1.5, color: C.body },
  obsBox: {
    marginTop: 6,
    marginBottom: 4,
    padding: 9,
    backgroundColor: C.soft2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: C.line,
  },
  foot: {
    position: "absolute",
    bottom: 12,
    left: 30,
    right: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.8,
    borderTopColor: C.line,
    paddingTop: 5,
  },
  footT: { fontSize: 6.2, color: C.faint },
});

// ————————————————————————————————————————————————————————————
// Types
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
    "&uuml;": "ü", "&Uuml;": "Ü",
    "&amp;": "&", "&nbsp;": " ", "&quot;": '"',
    "&#39;": "'", "&apos;": "'",
    "&lt;": "<", "&gt;": ">",
    "&ndash;": "–", "&mdash;": "—",
    "&deg;": "°", "&sect;": "§",
  };
  let out = String(input);
  for (const [entity, char] of Object.entries(map)) {
    if (out.includes(entity)) out = out.split(entity).join(char);
  }
  out = out.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
  out = out.replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );
  // strip residual tags
  out = out.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
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

function parseDateOnly(raw?: string): Date | null {
  if (!raw) return null;
  const iso = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const br = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
  // geradoEm: "03/08/2026, 13:40:00"
  const brTime = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (brTime) return new Date(Number(brTime[3]), Number(brTime[2]) - 1, Number(brTime[1]));
  return null;
}

function diasEmAtraso(proximoPrazo?: string, geradoEm?: string): number | null {
  const prazo = parseDateOnly(proximoPrazo);
  const geracao = parseDateOnly(geradoEm) || new Date();
  if (!prazo) return null;
  const diffMs = geracao.getTime() - prazo.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function truncate(text: string, max: number): string {
  const clean = text.trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).trim()}…`;
}

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

// ————————————————————————————————————————————————————————————
// Subcomponents
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
  const sc = clampScore(score);
  const nc = nivelColor(nivel);
  // barra proporcional (0–100 → %)
  const barWidthPct = `${sc}%`;
  return (
    <View style={s.riskGauge}>
      <Text style={s.riskLabel}>ÍNDICE DE RISCO</Text>
      <Text style={[s.riskNumber, { color: nc }]}>{sc}</Text>
      <Text style={s.riskOf}>de 100</Text>
      <View style={s.riskBarTrack}>
        <View style={[s.riskBarFill, { width: barWidthPct as any, backgroundColor: nc }]} />
      </View>
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
              <Text style={[s.sevPill, st]}>
                {normalizeSeveridade(d.severidade).toUpperCase()}
              </Text>
              <Text style={s.driverLab}>{d.label}</Text>
              <Text style={s.driverPts}>+{d.pontos}</Text>
            </View>
          );
        })
      )}
      {!!hint && <Text style={s.riskHint}>{hint}</Text>}
    </View>
  );
}

function TimelineItem({
  data,
  nome,
  complemento,
}: {
  data?: string;
  nome?: string;
  complemento?: string;
}) {
  const comp = complemento
    ? truncate(decodeHtmlEntities(complemento), MAX_CHARS_COMPLEMENTO)
    : "";
  return (
    <View style={s.tlRow}>
      <View style={s.tlDotCol}>
        <View style={s.tlDot} />
      </View>
      <Text style={s.tlDate}>{fmtShortDate(data)}</Text>
      <Text style={s.tlBody}>
        {nome || "Movimento"}
        {comp ? ` — ${comp}` : ""}
      </Text>
    </View>
  );
}

function DjenHighlight({ data, texto }: { data?: string; texto?: string }) {
  if (!texto) return null;
  const decoded = decodeHtmlEntities(texto);
  if (!decoded) return null;
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
    <View>
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
      <View style={s.headerAccent} />
    </View>
  );
}

function Footer({ left }: { left: string }) {
  return (
    <View style={s.foot} fixed>
      <Text style={s.footT}>{left}</Text>
      <Text
        style={s.footT}
        render={({ pageNumber, totalPages }) =>
          `Página ${pageNumber} de ${totalPages}`
        }
      />
    </View>
  );
}

// ————————————————————————————————————————————————————————————
// Document
// ————————————————————————————————————————————————————————————
export function DossieClientePDF({ data }: { data: DossieClientePdfData }) {
  const r = data.risco || ({} as DossieClientePdfData["risco"]);
  const atrasoDias = diasEmAtraso(data.proximoPrazo, data.geradoEm);
  const prazoAtrasado =
    (atrasoDias !== null && atrasoDias > 0) || /vencido/i.test(data.status || "");

  const movimentos = data.movimentos || [];
  const movsExibidos = movimentos.slice(0, MAX_MOVIMENTOS_EXIBIDOS);
  const movsRestantes = Math.max(0, movimentos.length - movsExibidos.length);

  const djenDestaque =
    (data.djen || []).find((d) => (d.texto || "").length > 40) || data.djen?.[0];

  const footerLabel =
    "LexisPredict · DataJud/DJEN + carteira — não substitui certidão oficial";

  const prazoLabel = data.proximoPrazo
    ? `${data.proximoPrazo}${
        atrasoDias && atrasoDias > 0
          ? ` · ${atrasoDias} dia${atrasoDias === 1 ? "" : "s"} em atraso`
          : ""
      }`
    : "—";

  const advogadoLabel = [data.advogado, data.escritorio].filter(Boolean).join("\n") || "—";

  return (
    <Document
      title={`Dossiê ${data.cliente || ""}`}
      author="LexisPredict"
      subject="Dossiê operacional estratégico do cliente"
      keywords="dossie,juridico,datajud,djen"
    >
      {/* PAGE 1 */}
      <Page size="A4" style={s.page}>
        <BrandHeader logoBase64={data.logoBase64} />

        <View style={s.clientBlock}>
          <Text style={s.clientName}>{data.cliente || "Cliente"}</Text>
          <Text style={s.metaLine}>
            Processo nº {data.protocolo || "—"}
            {data.tribunal ? `  ·  ${data.tribunal}` : ""}
            {"  ·  "}
            {data.geradoEm || ""}
          </Text>
        </View>

        <View style={s.content}>
          <View style={s.kpiRow}>
            <KpiCard label="Status da carteira" value={data.status || "—"} danger={prazoAtrasado} />
            <KpiCard label="Fase atual" value={r.faseAtual || "—"} />
            <KpiCard label="Advogado responsável" value={advogadoLabel} />
            <KpiCard label="Próximo prazo" value={prazoLabel} danger={prazoAtrasado} />
          </View>

          <View style={s.kpiRow}>
            <KpiCard label="Telefone" value={data.telefone || "—"} />
            <KpiCard label="Último retorno" value={data.ultimoRetorno || "—"} />
            <KpiCard label="Tribunal" value={data.tribunal || "—"} />
            <KpiCard label="Parte contrária" value={data.parteContraria || "—"} />
          </View>

          <View style={s.riskRow}>
            <RiskGauge score={r.score ?? 0} nivel={r.nivel || "—"} />
            <PriorityPanel drivers={r.drivers || []} hint={r.chanceRuim || ""} />
          </View>

          <Text style={s.h2}>Diagnóstico — pontos fortes e pontos de atenção</Text>
          <View style={s.diagRow}>
            <View style={s.colOk}>
              <Text style={[s.colTitle, { color: C.ok }]}>Pontos fortes</Text>
              {(r.pontosFortes || []).length === 0 ? (
                <Text style={s.bullet}>—</Text>
              ) : (
                (r.pontosFortes || []).map((t, i) => (
                  <Text key={i} style={s.bullet}>
                    • {t}
                  </Text>
                ))
              )}
            </View>
            <View style={s.colBad}>
              <Text style={[s.colTitle, { color: C.danger }]}>Pontos de atenção</Text>
              {(r.pontosAtencao || []).length === 0 ? (
                <Text style={s.bullet}>—</Text>
              ) : (
                (r.pontosAtencao || []).map((t, i) => (
                  <Text key={i} style={s.bullet}>
                    • {t}
                  </Text>
                ))
              )}
            </View>
          </View>

          <Text style={s.h2}>Linha do tempo processual (DataJud)</Text>
          <View style={s.tlWrap}>
            {movsExibidos.length === 0 ? (
              <Text style={s.bullet}>Nenhuma movimentação retornada nesta consulta.</Text>
            ) : (
              <>
                {movsExibidos.map((m, i) => (
                  <TimelineItem
                    key={i}
                    data={m.data}
                    nome={m.nome}
                    complemento={m.complemento}
                  />
                ))}
                {movsRestantes > 0 && (
                  <Text style={s.tlMore}>
                    + {movsRestantes} movimentação
                    {movsRestantes === 1 ? "" : "ões"} anterior
                    {movsRestantes === 1 ? "" : "es"} na consulta completa.
                  </Text>
                )}
              </>
            )}
          </View>

          {djenDestaque && (
            <DjenHighlight data={djenDestaque.data} texto={djenDestaque.texto} />
          )}
        </View>

        <Footer left={footerLabel} />
      </Page>

      {/* PAGE 2 */}
      <Page size="A4" style={s.page}>
        <View style={s.page2Stripe} />
        <View style={s.content}>
          <Text style={[s.clientName, { fontSize: 12, marginBottom: 2 }]}>
            {data.cliente || "Cliente"}
          </Text>
          <Text style={[s.metaLine, { marginBottom: 12 }]}>
            {data.protocolo || "—"} · Continuação do dossiê operacional
          </Text>

          <Text style={s.h2}>Resumo executivo</Text>
          <View style={s.execBox}>
            <Text style={s.execText}>{data.resumoProcesso || "—"}</Text>
          </View>

          {data.observacao ? (
            <View style={s.obsBox}>
              <Text style={[s.kpiLab, { marginBottom: 3 }]}>Observações do CRM</Text>
              <Text style={s.execText}>{data.observacao}</Text>
            </View>
          ) : null}

          <Text style={[s.h2, { marginTop: 10 }]}>Plano de ação recomendado</Text>
          {(r.planoAcao || []).length === 0 ? (
            <Text style={s.bullet}>Sem plano automático — revisar cronologia e CRM.</Text>
          ) : (
            (r.planoAcao || []).map((t, i) => (
              <PlanCard key={i} index={i} text={t} />
            ))
          )}

          <View style={s.strategyBox} wrap={false}>
            <Text style={s.strategyTitle}>LEITURA ESTRATÉGICA</Text>
            <Text style={s.strategyText}>
              {r.leituraEstrategica ||
                "Monitore o teor oficial e mantenha o cliente informado a cada marco relevante."}
            </Text>
          </View>
        </View>

        <Footer left={`LexisPredict · Dossiê Cliente · ${data.geradoEm || ""}`} />
      </Page>
    </Document>
  );
}
