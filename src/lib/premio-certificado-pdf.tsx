import React from "react";
import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 48,
    backgroundColor: "#0f172a",
    color: "#f8fafc",
    fontFamily: "Helvetica",
  },
  border: {
    borderWidth: 3,
    borderColor: "#f59e0b",
    borderStyle: "solid",
    borderRadius: 12,
    padding: 36,
    minHeight: 700,
    justifyContent: "center",
    alignItems: "center",
  },
  label: { fontSize: 11, letterSpacing: 3, color: "#fbbf24", marginBottom: 12, textTransform: "uppercase" },
  title: { fontSize: 22, fontFamily: "Helvetica-Bold", marginBottom: 8, textAlign: "center" },
  name: { fontSize: 28, fontFamily: "Helvetica-Bold", color: "#ffffff", marginVertical: 16, textAlign: "center" },
  sub: { fontSize: 12, color: "#94a3b8", textAlign: "center", marginBottom: 8, maxWidth: 400 },
  rank: { fontSize: 14, color: "#fbbf24", marginTop: 20, fontFamily: "Helvetica-Bold" },
  foot: { fontSize: 9, color: "#64748b", marginTop: 40, textAlign: "center" },
});

export function CertificadoDoc(props: {
  recipient: string;
  rank: 1 | 2 | 3;
  monthLabel: string;
  detalhe?: string;
}) {
  const place = props.rank === 1 ? "1º LUGAR" : props.rank === 2 ? "2º LUGAR" : "3º LUGAR";
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.border}>
          <Text style={styles.label}>LexisPredict · Hall de Prêmios</Text>
          <Text style={styles.title}>Certificado de Excelência</Text>
          <Text style={styles.sub}>Melhor atendente · análise de processos jurídicos</Text>
          <Text style={styles.name}>{props.recipient}</Text>
          <Text style={styles.rank}>{place}</Text>
          <Text style={styles.sub}>{props.monthLabel}</Text>
          {props.detalhe ? <Text style={styles.sub}>{props.detalhe}</Text> : null}
          <Text style={styles.foot}>
            Documento gerado pelo LexisPredict · {new Date().toLocaleString("pt-BR")}
          </Text>
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
  a.download = `LexisPredict_Certificado_${opts.rank}_${opts.recipient.replace(/\s+/g, "_").slice(0, 40)}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
