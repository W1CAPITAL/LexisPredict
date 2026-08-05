import React from "react";
import { Page, Text, View, Document, StyleSheet } from "@react-pdf/renderer";

const s = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 48,
    fontFamily: "Helvetica",
    fontSize: 11,
    lineHeight: 1.5,
    textAlign: "justify",
    color: "#0a0a0a",
  },
  title: {
    textAlign: "center",
    fontFamily: "Helvetica-Bold",
    fontSize: 13,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  subtitle: {
    textAlign: "center",
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    marginBottom: 10,
  },
  meta: { fontSize: 8, color: "#334155", marginBottom: 14, textAlign: "center" },
  p: { marginBottom: 11, textIndent: 28 },
  bold: { fontFamily: "Helvetica-Bold" },
  box: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 8,
    marginBottom: 12,
    fontSize: 8,
  },
  warn: {
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fdba74",
    padding: 8,
    marginBottom: 12,
    fontSize: 8,
  },
  date: { textAlign: "center", marginTop: 22, marginBottom: 28 },
  sig: { textAlign: "center", marginTop: 16 },
  line: {
    width: 220,
    borderTopWidth: 1,
    borderTopColor: "#000",
    alignSelf: "center",
    marginBottom: 4,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    fontSize: 7,
    color: "#64748b",
    textAlign: "center",
  },
});

export type RevogacaoPdfData = {
  comarca: string;
  dataExtenso: string;
  clienteNome: string;
  clienteCpf?: string | null;
  protocolo: string;
  tribunal?: string;
  revogado: {
    nome: string;
    oabCompleta: string;
    oabCurta: string;
    nacionalidade?: string;
    estadoCivil?: string;
    endereco?: string;
  };
  substabelecido: {
    nome: string;
    oabCompleta: string;
    oabCurta: string;
    nacionalidade?: string;
    estadoCivil?: string;
    endereco?: string;
    email?: string;
    telefone?: string;
  };
  ultimoAdvogadoDetectado?: string | null;
  advogadosDjen?: string[];
  viabilidade?: string | null;
  observacaoScanner?: string | null;
  analiseClaude?: string | null;
  engineClaude?: string | null;
};

export function RevogacaoPoderesPDF({ data }: { data: RevogacaoPdfData }) {
  const {
    comarca,
    dataExtenso,
    clienteNome,
    clienteCpf,
    protocolo,
    tribunal,
    revogado,
    substabelecido,
    ultimoAdvogadoDetectado,
    advogadosDjen,
    viabilidade,
    observacaoScanner,
  } = data;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.title}>Revogacao de mandato e substabelecimento</Text>
        <Text style={s.subtitle}>(sem reserva de poderes)</Text>
        <Text style={s.meta}>
          Processo n. {protocolo}{clienteCpf ? " · CPF " + clienteCpf : ""}
          {tribunal ? " - " + tribunal : ""}
          {ultimoAdvogadoDetectado
            ? " - Advogado de referencia: " + ultimoAdvogadoDetectado
            : ""}
        </Text>

        {viabilidade ? (
          <View style={s.warn}>
            <Text style={s.bold}>Analise de oportunidade (scanner / DJEN)</Text>
            <Text>{viabilidade}</Text>
          </View>
        ) : null}

        {(advogadosDjen && advogadosDjen.length > 0) || observacaoScanner ? (
          <View style={s.box}>
            {advogadosDjen && advogadosDjen.length > 0 ? (
              <Text>Advogados em DJEN recente: {advogadosDjen.join("; ")}</Text>
            ) : null}
            {observacaoScanner ? <Text>Nota: {observacaoScanner}</Text> : null}
          </View>
        ) : null}

        <View style={s.p}>
          <Text>
            O(A) advogado(a){" "}
            <Text style={s.bold}>{String(revogado.nome || "").toUpperCase()}</Text>,{" "}
            {revogado.nacionalidade || "brasileiro(a)"},{" "}
            {revogado.estadoCivil || "estado civil nao informado"}, inscrito(a) na{" "}
            <Text style={s.bold}>{revogado.oabCompleta}</Text>
            {revogado.endereco
              ? ", com endereco profissional em " + revogado.endereco
              : ""}
            , no exercicio dos poderes que lhe foram outorgados pela parte{" "}
            <Text style={s.bold}>{String(clienteNome || "").toUpperCase()}</Text> nos
            autos do processo n. <Text style={s.bold}>{protocolo}</Text>,{" "}
            <Text style={s.bold}>REVOGA</Text> os poderes antes conferidos a si para a
            pratica de atos neste feito, na medida em que{" "}
            <Text style={s.bold}>SUBSTABELECE, SEM RESERVA DE PODERES</Text>, na pessoa
            do(a) advogado(a){" "}
            <Text style={s.bold}>
              {String(substabelecido.nome || "").toUpperCase()}
            </Text>
            , {substabelecido.nacionalidade || "brasileiro(a)"},{" "}
            {substabelecido.estadoCivil || "estado civil nao informado"}, inscrito(a)
            na <Text style={s.bold}>{substabelecido.oabCompleta}</Text>
            {substabelecido.endereco
              ? ", com endereco profissional em " + substabelecido.endereco
              : ""}
            {substabelecido.email ? ", e-mail " + substabelecido.email : ""}
            {substabelecido.telefone ? ", telefone " + substabelecido.telefone : ""}
            , todos os poderes outorgados pela parte acima identificada, para o foro
            em geral, com a clausula ad judicia et extra, inclusive os especiais de
            substabelecer, acordar, discordar, transigir, desistir, receber e dar
            quitacao, firmar compromisso e quanto mais se faca necessario ao bom
            andamento da causa.
          </Text>
        </View>

        <View style={s.p}>
          <Text>
            Requer-se a exclusao do(a) advogado(a) substabelecente{" "}
            <Text style={s.bold}>{String(revogado.nome || "").toUpperCase()}</Text> (
            <Text style={s.bold}>{revogado.oabCurta}</Text>) da contracapa dos autos e
            de qualquer cadastro de intimacao, passando as futuras intimacoes e
            publicacoes a serem dirigidas{" "}
            <Text style={s.bold}>exclusivamente</Text> ao(a) substabelecido(a){" "}
            <Text style={s.bold}>
              {String(substabelecido.nome || "").toUpperCase()}
            </Text>{" "}
            (<Text style={s.bold}>{substabelecido.oabCurta}</Text>), nos termos do art.
            272, paragrafo 5o, do Codigo de Processo Civil, sob pena de nulidade.
          </Text>
        </View>

        <View style={s.p}>
          <Text>
            Declara o(a) substabelecente que o presente instrumento e lavrado para
            regularizacao da representacao processual, sem prejuizo das
            responsabilidades profissionais ja assumidas ate a data desta assinatura,
            e que a parte outorgante permanece com a tutela de seus interesses
            assegurada pelo(a) novo(a) patrono(a).
          </Text>
        </View>

        {/* Claude nao aparece no PDF */}

        <Text style={s.date}>
          {comarca}, {dataExtenso}.
        </Text>

        <View style={s.sig}>
          <View style={s.line} />
          <Text style={s.bold}>{String(revogado.nome || "").toUpperCase()}</Text>
          <Text>{revogado.oabCurta}</Text>
          <Text style={{ fontSize: 8 }}>Substabelecente</Text>
        </View>

        <View style={{ marginTop: 24 }} />

        <View style={s.sig}>
          <View style={s.line} />
          <Text style={s.bold}>
            {String(substabelecido.nome || "").toUpperCase()}
          </Text>
          <Text>{substabelecido.oabCurta}</Text>
          <Text style={{ fontSize: 8 }}>Substabelecido / intimacoes exclusivas</Text>
        </View>

        <Text style={s.footer}>
          LexisPredict - Conferir dados da banca e do tribunal antes do protocolo -{" "}
          {new Date().toISOString()}
        </Text>
      </Page>
    </Document>
  );
}
