/**
 * PDF profissional — Publicação / decisão DJEN
 * LexisPredict · leitura clara + destaques de termos críticos
 */
import React from "react";
import {
  Page,
  Text,
  View,
  Document,
  StyleSheet,
  Font,
  Image,
} from "@react-pdf/renderer";

Font.register({
  family: "Times-Roman",
  fonts: [
    {
      src: "https://cdn.jsdelivr.net/npm/@canvas-fonts/times-new-roman@1.0.4/Times-New-Roman.ttf",
    },
    {
      src: "https://cdn.jsdelivr.net/npm/@canvas-fonts/times-new-roman@1.0.4/Times-New-Roman-Bold.ttf",
      fontWeight: "bold",
    },
  ],
});

const COLORS = {
  ink: "#0f172a",
  muted: "#475569",
  line: "#cbd5e1",
  brand: "#0ea5e9",
  brandDark: "#0c4a6e",
  warnBg: "#fef3c7",
  warnBorder: "#f59e0b",
  dangerBg: "#fee2e2",
  dangerBorder: "#ef4444",
  okBg: "#dcfce7",
  okBorder: "#22c55e",
  soft: "#f8fafc",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 48,
    paddingHorizontal: 36,
    fontFamily: "Times-Roman",
    fontSize: 10.5,
    lineHeight: 1.55,
    color: COLORS.ink,
  },
  brandBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.brandDark,
  },
  brandLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logo: {
    width: 36,
    height: 36,
    objectFit: "contain",
  },
  brandName: {
    fontSize: 12,
    fontWeight: "bold",
    color: COLORS.brandDark,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  brandSub: {
    fontSize: 7.5,
    color: COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 2,
  },
  docBadge: {
    backgroundColor: COLORS.brandDark,
    color: "#fff",
    fontSize: 7,
    fontWeight: "bold",
    paddingVertical: 4,
    paddingHorizontal: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 13,
    fontWeight: "bold",
    textAlign: "center",
    textTransform: "uppercase",
    marginTop: 8,
    marginBottom: 12,
    color: COLORS.brandDark,
    letterSpacing: 0.4,
  },
  metaBox: {
    backgroundColor: COLORS.soft,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 10,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: "row",
    marginBottom: 3,
  },
  metaLabel: {
    width: 130,
    fontSize: 8,
    fontWeight: "bold",
    color: COLORS.muted,
    textTransform: "uppercase",
  },
  metaValue: {
    flex: 1,
    fontSize: 9.5,
    color: COLORS.ink,
  },
  sectionTitle: {
    fontSize: 9,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: COLORS.brandDark,
    marginBottom: 6,
    marginTop: 4,
    borderBottomWidth: 0.8,
    borderBottomColor: COLORS.line,
    paddingBottom: 3,
  },
  highlightBox: {
    borderWidth: 1,
    borderColor: COLORS.warnBorder,
    backgroundColor: COLORS.warnBg,
    padding: 8,
    marginBottom: 12,
  },
  highlightTitle: {
    fontSize: 8,
    fontWeight: "bold",
    textTransform: "uppercase",
    marginBottom: 4,
    color: "#92400e",
  },
  highlightItem: {
    fontSize: 9,
    marginBottom: 2,
    color: COLORS.ink,
  },
  body: {
    marginTop: 4,
    textAlign: "justify",
  },
  paragraph: {
    marginBottom: 8,
    fontSize: 10.5,
    lineHeight: 1.6,
  },
  mark: {
    fontWeight: "bold",
    backgroundColor: "#fde68a",
  },
  markDanger: {
    fontWeight: "bold",
    backgroundColor: "#fecaca",
  },
  markOk: {
    fontWeight: "bold",
    backgroundColor: "#bbf7d0",
  },
  footer: {
    position: "absolute",
    bottom: 22,
    left: 36,
    right: 36,
    borderTopWidth: 0.8,
    borderTopColor: COLORS.line,
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 7,
    color: COLORS.muted,
    textTransform: "uppercase",
  },
  claudeBox: {
    backgroundColor: "#f5f3ff",
    borderWidth: 1,
    borderColor: "#c4b5fd",
    padding: 10,
    marginBottom: 12,
    marginTop: 4,
  },
  claudeTitle: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#5b21b6",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  claudeBody: {
    fontSize: 9.5,
    lineHeight: 1.5,
    color: COLORS.ink,
  },
  disclaimer: {
    marginTop: 16,
    fontSize: 7.5,
    color: COLORS.muted,
    textAlign: "center",
    lineHeight: 1.4,
  },
});

/** Termos críticos para destaque no corpo do texto */
const HIGHLIGHT_RULES: Array<{ re: RegExp; style: "mark" | "markDanger" | "markOk"; label: string }> = [
  { re: /busca\s+e\s+apreens[aã]o|mandado\s+de\s+busca/gi, style: "markDanger", label: "Busca e apreensão" },
  { re: /tr[aâ]nsito\s+em\s+julgado|baixa\s+definitiva|arquivamento/gi, style: "mark", label: "Trânsito / baixa" },
  { re: /improcedente|negado\s+provimento|reforma\s+da\s+senten[cç]a/gi, style: "markDanger", label: "Desfecho desfavorável" },
  { re: /procedente(?!\s+em\s+parte)|julgad[oa]\s+procedente/gi, style: "markOk", label: "Procedente" },
  { re: /liminar|tutela\s+de\s+urg[eê]ncia|antecipa[cç][aã]o\s+de\s+tutela/gi, style: "mark", label: "Liminar / tutela" },
  { re: /audi[eê]ncia|concilia[cç][aã]o/gi, style: "mark", label: "Audiência" },
  { re: /custas|preparo|taxa\s+judici[aá]ria/gi, style: "mark", label: "Custas / preparo" },
  { re: /prazo\s+de\s+\d+\s*\(?\w*\)?\s*dias|intima[cç][aã]o/gi, style: "mark", label: "Prazo / intimação" },
  { re: /senten[cç]a|ac[oó]rd[aã]o|despacho|decis[aã]o/gi, style: "mark", label: "Decisão judicial" },
];

/** Compilada uma vez a partir de padrões estáticos (sem input do usuário). */
const COMBINED_HIGHLIGHT = new RegExp(
  "(" + HIGHLIGHT_RULES.map((r) => r.re.source).join("|") + ")",
  "gi"
);

function extractHighlights(texto: string): string[] {
  const found = new Set<string>();
  const t = texto || "";
  for (const rule of HIGHLIGHT_RULES) {
    rule.re.lastIndex = 0;
    if (rule.re.test(t)) found.add(rule.label);
  }
  return Array.from(found);
}

function renderHighlightedText(texto: string) {
  const raw = String(texto || "").replace(/\r\n/g, "\n").trim();
  if (!raw) return <Text style={styles.paragraph}>—</Text>;

  const combined = COMBINED_HIGHLIGHT;
  const parts = raw.split(combined).filter((p) => p !== undefined && p !== "");

  // Agrupa em parágrafos por quebras duplas
  const paragraphs = raw.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length > 1) {
    return paragraphs.map((para, pi) => {
      const segs = para.split(combined);
      return (
        <Text key={pi} style={styles.paragraph}>
          {segs.map((seg, i) => {
            if (!seg) return null;
            const rule = HIGHLIGHT_RULES.find((r) => {
              // usa regex estática (sem new RegExp dinâmico)
              r.re.lastIndex = 0;
              const m = seg.match(r.re);
              return !!(m && m[0] === seg);
            });
            if (rule) {
              return (
                <Text key={i} style={styles[rule.style]}>
                  {seg}
                </Text>
              );
            }
            return <Text key={i}>{seg}</Text>;
          })}
        </Text>
      );
    });
  }

  return (
    <Text style={styles.paragraph}>
      {parts.map((seg, i) => {
        const rule = HIGHLIGHT_RULES.find((r) => {
          r.re.lastIndex = 0;
          const m = seg.match(r.re);
          return !!(m && m[0] === seg);
        });
        if (rule) {
          return (
            <Text key={i} style={styles[rule.style]}>
              {seg}
            </Text>
          );
        }
        return <Text key={i}>{seg}</Text>;
      })}
    </Text>
  );
}

export type DjenPdfData = {
  titulo?: string;
  protocolo?: string;
  data?: string;
  orgao?: string;
  tipo?: string;
  texto?: string;
  cliente?: string;
  tribunal?: string;
  logoBase64?: string | null;
  /** Parecer Claude AI sobre a publicação */
  analiseClaude?: string | null;
  claudeEngine?: string | null;
};


function formatTeorForPdf(raw: string): string {
  let s = String(raw || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
  // força quebras em padrões de decisão
  s = s
    .replace(/\s+(?=\d+\.\s)/g, "\n\n")
    .replace(/\s+(?=Art\.\s)/gi, "\n")
    .replace(/\s+(?=DESPACHO)/gi, "\n\n")
    .replace(/\s+(?=Vistos)/gi, "\n\n")
    .replace(/\s+(?=Intimem-se)/gi, "\n\n")
    .replace(/\n{3,}/g, "\n\n");
  return s;
}

export function DjenPublicationPDF({ data }: { data: DjenPdfData }) {
  const texto = data.texto || "";
  const highlights = extractHighlights(texto);
  const geradoEm = new Date().toLocaleString("pt-BR");
  const analiseClaude = data.analiseClaude || null;
  const claudeEngine = data.claudeEngine || "Claude AI";

  return (
    <Document
      title={`DJEN ${data.protocolo || ""}`}
      author="LexisPredict"
      subject="Publicação Diário de Justiça Eletrônico Nacional"
    >
      <Page size="A4" style={styles.page}>
        {/* Cabeçalho marca */}
        <View style={styles.brandBar}>
          <View style={styles.brandLeft}>
            {data.logoBase64 ? (
              <Image src={data.logoBase64} style={styles.logo} />
            ) : (
              <View
                style={{
                  width: 36,
                  height: 36,
                  backgroundColor: COLORS.brandDark,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "#fff", fontSize: 14, fontWeight: "bold" }}>L</Text>
              </View>
            )}
            <View>
              <Text style={styles.brandName}>LexisPredict</Text>
              <Text style={styles.brandSub}>Gabinete · Operações forenses</Text>
            </View>
          </View>
          <Text style={styles.docBadge}>DJEN · Extração oficial</Text>
        </View>

        <Text style={styles.title}>
          {data.titulo || "Publicação / decisão — Diário de Justiça"}
        </Text>

        {/* Metadados */}
        <View style={styles.metaBox}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Processo (CNJ)</Text>
            <Text style={styles.metaValue}>{data.protocolo || "—"}</Text>
          </View>
          {data.cliente ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Cliente</Text>
              <Text style={styles.metaValue}>{data.cliente}</Text>
            </View>
          ) : null}
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Disponibilização</Text>
            <Text style={styles.metaValue}>{data.data || "—"}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Órgão</Text>
            <Text style={styles.metaValue}>{data.orgao || data.tribunal || "—"}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Tipo</Text>
            <Text style={styles.metaValue}>{data.tipo || "Publicação"}</Text>
          </View>
        </View>

        {/* Destaques automáticos */}
        {highlights.length > 0 && (
          <View style={styles.highlightBox}>
            <Text style={styles.highlightTitle}>Pontos de atenção detectados no teor</Text>
            {highlights.map((h, i) => (
              <Text key={i} style={styles.highlightItem}>
                • {h}
              </Text>
            ))}
          </View>
        )}


        {analiseClaude ? (
          <View style={styles.claudeBox}>
            <Text style={styles.claudeTitle}>
              {claudeEngine} — Explicação da publicação
            </Text>
            <Text style={styles.claudeBody}>{analiseClaude}</Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Teor da publicação</Text>
        <View style={styles.body}>{renderHighlightedText(texto)}</View>

        <Text style={styles.disclaimer}>
          Documento gerado pelo LexisPredict a partir de dados do Diário de Justiça Eletrônico
          Nacional (DJEN / PJe). Confira sempre o teor integral no portal oficial do tribunal.
          Uso operacional interno — não substitui certidão oficial.
        </Text>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>LexisPredict Elite · Fonte DJEN</Text>
          <Text style={styles.footerText}>Gerado em {geradoEm}</Text>
        </View>
      </Page>
    </Document>
  );
}
