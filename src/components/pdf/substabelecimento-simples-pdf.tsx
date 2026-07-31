/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved. See LICENSE file.
 */
import React from 'react';
import { Page, Text, View, Document, StyleSheet, Font } from '@react-pdf/renderer';

Font.register({
  family: 'Times-Roman',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/npm/@canvas-fonts/times-new-roman@1.0.4/Times-New-Roman.ttf' },
    { src: 'https://cdn.jsdelivr.net/npm/@canvas-fonts/times-new-roman@1.0.4/Times-New-Roman-Bold.ttf', fontWeight: 'bold' }
  ]
});

const styles = StyleSheet.create({
  page: {
    padding: '25mm 20mm',
    fontFamily: 'Times-Roman',
    fontSize: 11,
    lineHeight: 1.45,
    textAlign: 'justify',
    color: '#000000'
  },
  title: {
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 12,
    marginBottom: 4,
    textTransform: 'uppercase'
  },
  subtitle: {
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 11,
    marginBottom: 25,
  },
  paragraph: {
    marginBottom: 30,
    textIndent: 40,
  },
  bold: {
    fontWeight: 'bold'
  },
  dateArea: {
    marginTop: 20,
    marginBottom: 40,
    textAlign: 'center',
  },
  signatureArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginTop: 10,
    gap: 30
  },
  signatureBlock: {
    width: '60%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  line: {
    width: '100%',
    borderTop: '1pt solid black',
    marginBottom: 4,
  }
});

export function SubstabelecimentoSimplesPDF({ data }: { data: any }) {
  const { 
    substabelecente, 
    substabelecido, 
    numeroProcesso, 
    parteNome,
    cidadeData,
    tipoAcao = "AÇÃO REVISIONAL DE CONTRATO BANCÁRIO",
    template = 'padrao'
  } = data;

  if (template === 'cpc272') {
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <Text style={styles.title}>SUBSTABELECIMENTO</Text>
          <Text style={styles.subtitle}>(sem reserva de poderes)</Text>

          <View style={styles.paragraph}>
            <Text>
              O <Text style={styles.bold}>DR(A). {substabelecente.nome.toUpperCase()}</Text>, brasileiro(a), advogado(a), inscrito(a) na <Text style={styles.bold}>{substabelecente.oabCompleta}</Text>, <Text style={styles.bold}>SUBSTABELECE SEM RESERVA DE PODERES</Text> na pessoa do <Text style={styles.bold}>DR(A). {substabelecido.nome.toUpperCase()}</Text>, inscrito(a) na <Text style={styles.bold}>{substabelecido.oabCompleta}</Text>, os poderes conferidos por <Text style={styles.bold}>{parteNome.toUpperCase()}</Text>, <Text style={styles.bold}>PARA A PROMOÇÃO DE {tipoAcao.toUpperCase()}</Text>, processo de n.º <Text style={styles.bold}>{numeroProcesso}</Text> por meio do instrumento outrora outorgado, requerendo a exclusão do advogado substabelecente <Text style={styles.bold}>{substabelecente.nome.toUpperCase()}</Text> sob <Text style={styles.bold}>{substabelecente.oabCurta}</Text> da contracapa dos autos, bem como de qualquer outro meio de intimação do processo sendo assim que <Text style={styles.bold}>todas as futuras intimações passem a ser exclusivamente dirigidas ao substabelecido</Text>, <Text style={styles.bold}>{substabelecido.nome.toUpperCase()}</Text> sob <Text style={styles.bold}>{substabelecido.oabCurta}</Text>, nos termos do artigo 272, §5º, do CPC, sob pena de nulidade.
            </Text>
          </View>

          <Text style={styles.dateArea}>{cidadeData}</Text>

          <View style={styles.signatureArea}>
            <View style={styles.signatureBlock}>
              <View style={styles.line} />
              <Text style={styles.bold}>{substabelecente.nome.toUpperCase()}</Text>
              <Text style={styles.bold}>{substabelecente.oabCurta}</Text>
            </View>

            <View style={styles.signatureBlock}>
              <View style={styles.line} />
              <Text style={styles.bold}>{substabelecido.nome.toUpperCase()}</Text>
              <Text style={styles.bold}>{substabelecido.oabCurta}</Text>
            </View>
          </View>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={[styles.title, { textDecoration: 'underline', marginBottom: 30 }]}>SUBSTABELECIMENTO SEM RESERVA DE PODERES</Text>

        <View style={styles.paragraph}>
          <Text>
            Pelo presente instrumento, <Text style={styles.bold}>Dr. {substabelecente.nome}</Text>, advogado regularmente inscrito na <Text style={styles.bold}>{substabelecente.oabCompleta}</Text>, substabelece, <Text style={styles.bold}>SEM RESERVA DE PODERES</Text>, ao <Text style={styles.bold}>Dr. {substabelecido.nome}</Text>, advogado inscrito na <Text style={styles.bold}>{substabelecido.oabCompleta}</Text>, todos os poderes que lhe foram conferidos nos autos do processo nº <Text style={styles.bold}>{numeroProcesso}</Text>, para que represente os interesses da parte <Text style={styles.bold}>{parteNome}</Text>.
          </Text>
        </View>

        <Text style={styles.dateArea}>{cidadeData}</Text>

        <View style={styles.signatureArea}>
          <View style={styles.signatureBlock}>
            <View style={styles.line} />
            <Text style={styles.bold}>{substabelecente.nome.toUpperCase()}</Text>
            <Text style={styles.bold}>{substabelecente.oabCurta}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
