/**
 * Carta de Revogação de Poderes + Substabelecimento sem reserva.
 */
import React from 'react';
import { Page, Text, View, Document, StyleSheet, Font } from '@react-pdf/renderer';

try {
  Font.register({
    family: 'Times-Roman',
    fonts: [
      { src: 'https://cdn.jsdelivr.net/npm/@canvas-fonts/times-new-roman@1.0.4/Times-New-Roman.ttf' },
      {
        src: 'https://cdn.jsdelivr.net/npm/@canvas-fonts/times-new-roman@1.0.4/Times-New-Roman-Bold.ttf',
        fontWeight: 'bold',
      },
    ],
  });
} catch {
  /* */
}

const s = StyleSheet.create({
  page: {
    padding: '28mm 22mm',
    fontFamily: 'Times-Roman',
    fontSize: 11.5,
    lineHeight: 1.55,
    textAlign: 'justify',
    color: '#0a0a0a',
  },
  title: {
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 13,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  subtitle: {
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 11,
    marginBottom: 22,
  },
  p: { marginBottom: 12, textIndent: 36 },
  bold: { fontWeight: 'bold' },
  meta: { fontSize: 9, color: '#334155', marginBottom: 14, textAlign: 'center' },
  date: { textAlign: 'center', marginTop: 28, marginBottom: 36 },
  sig: { textAlign: 'center', marginTop: 18, alignItems: 'center' },
  line: {
    width: '55%',
    borderTop: '1pt solid #000',
    alignSelf: 'center',
    marginBottom: 6,
  },
  footer: { position: 'absolute', bottom: 18, left: 22, right: 22, fontSize: 8, color: '#64748b', textAlign: 'center' },
});

export type RevogacaoPdfData = {
  comarca: string;
  dataExtenso: string;
  clienteNome: string;
  protocolo: string;
  tribunal?: string;
  /** Advogado cujos poderes se revogam / substabelecente */
  revogado: {
    nome: string;
    oabCompleta: string;
    oabCurta: string;
    nacionalidade?: string;
    estadoCivil?: string;
    endereco?: string;
  };
  /** Advogado que recebe os poderes */
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
  observacaoScanner?: string | null;
};

export function RevogacaoPoderesPDF({ data }: { data: RevogacaoPdfData }) {
  const {
    comarca,
    dataExtenso,
    clienteNome,
    protocolo,
    tribunal,
    revogado,
    substabelecido,
    ultimoAdvogadoDetectado,
    observacaoScanner,
  } = data;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.title}>Revogação de mandato e substabelecimento</Text>
        <Text style={s.subtitle}>(sem reserva de poderes)</Text>
        <Text style={s.meta}>
          Processo nº {protocolo}
          {tribunal ? ` · ${tribunal}` : ''}
          {ultimoAdvogadoDetectado
            ? ` · Advogado atual nos autos (referência): ${ultimoAdvogadoDetectado}`
            : ''}
        </Text>

        <View style={s.p}>
          <Text>
            O(A) advogado(a){' '}
            <Text style={s.bold}>{revogado.nome.toUpperCase()}</Text>,{' '}
            {revogado.nacionalidade || 'brasileiro(a)'}, {revogado.estadoCivil || 'estado civil não informado'},
            inscrito(a) na <Text style={s.bold}>{revogado.oabCompleta}</Text>
            {revogado.endereco ? `, com endereço profissional em ${revogado.endereco}` : ''}, no exercício
            dos poderes que lhe foram outorgados pela parte{' '}
            <Text style={s.bold}>{clienteNome.toUpperCase()}</Text> nos autos do processo nº{' '}
            <Text style={s.bold}>{protocolo}</Text>,{' '}
            <Text style={s.bold}>REVOGA</Text> os poderes antes conferidos a si para a prática de atos neste
            feito, na medida em que{' '}
            <Text style={s.bold}>SUBSTABELECE, SEM RESERVA DE PODERES</Text>, na pessoa do(a) advogado(a){' '}
            <Text style={s.bold}>{substabelecido.nome.toUpperCase()}</Text>,{' '}
            {substabelecido.nacionalidade || 'brasileiro(a)'},{' '}
            {substabelecido.estadoCivil || 'estado civil não informado'}, inscrito(a) na{' '}
            <Text style={s.bold}>{substabelecido.oabCompleta}</Text>
            {substabelecido.endereco ? `, com endereço profissional em ${substabelecido.endereco}` : ''}
            {substabelecido.email ? `, e-mail ${substabelecido.email}` : ''}
            {substabelecido.telefone ? `, telefone ${substabelecido.telefone}` : ''}, todos os poderes
            outorgados pela parte acima identificada, para o foro em geral, com a cláusula ad judicia et extra,
            inclusive os especiais de substabelecer, acordar, discordar, transigir, desistir, receber e dar
            quitação, firmar compromisso e quanto mais se faça necessário ao bom andamento da causa.
          </Text>
        </View>

        <View style={s.p}>
          <Text>
            Requer-se a exclusão do(a) advogado(a) substabelecente{' '}
            <Text style={s.bold}>{revogado.nome.toUpperCase()}</Text> (
            <Text style={s.bold}>{revogado.oabCurta}</Text>) da contracapa dos autos e de qualquer cadastro de
            intimação, passando as futuras intimações e publicações a serem dirigidas{' '}
            <Text style={s.bold}>exclusivamente</Text> ao(à) substabelecido(a){' '}
            <Text style={s.bold}>{substabelecido.nome.toUpperCase()}</Text> (
            <Text style={s.bold}>{substabelecido.oabCurta}</Text>), nos termos do art. 272, § 5º, do Código de
            Processo Civil, sob pena de nulidade.
          </Text>
        </View>

        <View style={s.p}>
          <Text>
            Declara o(a) substabelecente que o presente instrumento é lavrado para regularização da
            representação processual, sem prejuízo das responsabilidades profissionais já assumidas até a
            data desta assinatura, e que a parte outorgante permanece com a tutela de seus interesses
            assegurada pelo(a) novo(a) patrono(a).
          </Text>
        </View>

        {observacaoScanner ? (
          <View style={s.p}>
            <Text style={{ fontSize: 9, color: '#475569' }}>
              Nota operacional (scanner LexisPredict): {observacaoScanner}
            </Text>
          </View>
        ) : null}

        <Text style={s.date}>
          {comarca}, {dataExtenso}.
        </Text>

        <View style={s.sig}>
          <View style={s.line} />
          <Text style={s.bold}>{revogado.nome.toUpperCase()}</Text>
          <Text>{revogado.oabCurta}</Text>
          <Text style={{ fontSize: 9 }}>Substabelecente / poderes revogados neste feito</Text>
        </View>

        <View style={{ marginTop: 28 }} />

        <View style={s.sig}>
          <View style={s.line} />
          <Text style={s.bold}>{substabelecido.nome.toUpperCase()}</Text>
          <Text>{substabelecido.oabCurta}</Text>
          <Text style={{ fontSize: 9 }}>Substabelecido / intimações exclusivas</Text>
        </View>

        <Text style={s.footer}>
          LexisPredict · Documento gerado para uso profissional · Conferir dados da banca e do processo antes
          do protocolo
        </Text>
      </Page>
    </Document>
  );
}
