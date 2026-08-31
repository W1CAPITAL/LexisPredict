import React from "react";
import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 36,
    backgroundColor: "#ffffff",
    fontFamily: "Times-Roman",
  },
  outer: {
    borderWidth: 2,
    borderColor: "#1e3a5f",
    padding: 10,
    height: "100%",
  },
  inner: {
    borderWidth: 1,
    borderColor: "#c4a35a",
    padding: 28,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    fontSize: 11,
    letterSpacing: 4,
    color: "#1e3a5f",
    textTransform: "uppercase",
    marginBottom: 6,
    fontFamily: "Times-Bold",
  },
  brand: {
    fontSize: 10,
    color: "#64748b",
    marginBottom: 18,
  },
  title: {
    fontSize: 26,
    fontFamily: "Times-Bold",
    color: "#0f172a",
    marginBottom: 8,
    textAlign: "center",
  },
  line: {
    width: 180,
    height: 1,
    backgroundColor: "#c4a35a",
    marginVertical: 12,
  },
  intro: {
    fontSize: 12,
    color: "#334155",
    textAlign: "center",
    marginBottom: 10,
    maxWidth: 420,
    lineHeight: 1.5,
  },
  name: {
    fontSize: 22,
    fontFamily: "Times-Bold",
    color: "#0f172a",
    textAlign: "center",
    marginVertical: 12,
    maxWidth: 460,
  },
  body: {
    fontSize: 12,
    color: "#334155",
    textAlign: "center",
    maxWidth: 440,
    lineHeight: 1.55,
    marginBottom: 8,
  },
  rank: {
    fontSize: 14,
    fontFamily: "Times-Bold",
    color: "#1e3a5f",
    marginTop: 16,
    letterSpacing: 2,
  },
  month: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 6,
  },
  foot: {
    position: "absolute",
    bottom: 48,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sign: {
    fontSize: 9,
    color: "#64748b",
    textAlign: "center",
    width: 160,
  },
  signLine: {
    borderTopWidth: 1,
    borderTopColor: "#94a3b8",
    marginTop: 28,
    paddingTop: 4,
  },
});

export function CertificadoDoc(props: {
  recipient: string;
  rank: 1 | 2 | 3;
  monthLabel: string;
  detalhe?: string;
}) {
  const place =
    props.rank === 1 ? "1º LUGAR" : props.rank === 2 ? "2º LUGAR" : "3º LUGAR";
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.outer}>
          <View style={styles.inner}>
            <Text style={styles.header}>Certificado de reconhecimento</Text>
            <Text style={styles.brand}>LexisPredict · Suite operacional de carteira jurídica</Text>
            <Text style={styles.title}>Hall de Prêmios</Text>
            <View style={styles.line} />
            <Text style={styles.intro}>
              Certificamos que o(a) profissional abaixo identificado(a) destacou-se na
              análise e atendimento de processos jurídicos no período de referência.
            </Text>
            <Text style={styles.name}>{props.recipient}</Text>
            <Text style={styles.body}>
              Pela excelência operacional no gabinete — priorização de prazos, qualidade
              de atendimento e disciplina na carteira — é conferida a classificação:
            </Text>
            <Text style={styles.rank}>{place}</Text>
            <Text style={styles.month}>
              {props.monthLabel}
              {props.detalhe ? ` · ${props.detalhe}` : ""}
            </Text>
            <View style={styles.foot}>
              <View style={styles.sign}>
                <View style={styles.signLine} />
                <Text>Direção / Supervisão</Text>
              </View>
              <View style={styles.sign}>
                <View style={styles.signLine} />
                <Text>LexisPredict</Text>
              </View>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export async function downloadCertificadoPdf(opts: {
  recipient: string;
  rank: 1 | 2 | 3;
  monthLabel: string;
  detalhe?: string;
}) {
  const blob = await pdf(
    <CertificadoDoc
      recipient={opts.recipient}
      rank={opts.rank}
      monthLabel={opts.monthLabel}
      detalhe={opts.detalhe}
    />
  ).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safe = opts.recipient.replace(/[^\wÀ-ÿ]+/g, "_").slice(0, 40);
  a.download = `Certificado_LexisPredict_${opts.rank}_${safe}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
