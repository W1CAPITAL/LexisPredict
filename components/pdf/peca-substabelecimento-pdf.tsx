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
    padding: '30mm 25mm',
    fontFamily: 'Times-Roman',
    fontSize: 12,
    lineHeight: 1.8,
    textAlign: 'justify',
  },
  title: {
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 5,
    textTransform: 'uppercase',
  },
  subtitle: {
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 12,
    marginBottom: 60,
  },
  paragraph: {
    marginBottom: 60,
    textIndent: 60,
  },
  bold: {
    fontWeight: 'bold'
  },
  dateArea: {
    textAlign: 'center',
    marginBottom: 80,
  },
  signatureArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 60,
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
    marginBottom: 5,
  }
});

export function PecaSubstabelecimentoPDF({ data }: { data: any }) {
  const { 
    advogadoSubstabelecente, estadoCivilSubstabelecente, oabSubstabelecente, oabSubstabelecenteCurta,
    advogadoSubstabelecido, oabSubstabelecido, oabSubstabelecidoCurta,
    clienteNome, tipoAcao, reuNome, reuCnpj, numeroProcesso, cidadeComarca, dataFormatada, includeBankInfo, includeProcessNumber 
  } = data;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>SUBSTABELECIMENTO</Text>
        <Text style={styles.subtitle}>(sem reserva de poderes)</Text>

        <View style={styles.paragraph}>
          <Text>
            O <Text style={styles.bold}>{advogadoSubstabelecente}</Text>, brasileiro, {estadoCivilSubstabelecente}, advogado, inscrito na <Text style={styles.bold}>{oabSubstabelecente}</Text>, <Text style={styles.bold}>SUBSTABELECE SEM RESERVA DE PODERES</Text> na pessoa do <Text style={styles.bold}>{advogadoSubstabelecido}</Text>, inscrito na <Text style={styles.bold}>{oabSubstabelecido}</Text>, os poderes conferidos por <Text style={styles.bold}>{clienteNome}</Text>, <Text style={styles.bold}>PARA A PROMOÇÃO DE {tipoAcao}</Text> {includeBankInfo ? `promovida contra o ${reuNome.toUpperCase()}, inscrito no CNPJ sob o nº ${reuCnpj || '---'}` : ""}{includeProcessNumber ? `, processo de n.º ${numeroProcesso}` : ""} por meio do instrumento outrora outorgado, requerendo a exclusão do advogado substabelecente <Text style={styles.bold}>{advogadoSubstabelecente}</Text> sob <Text style={styles.bold}>{oabSubstabelecenteCurta}</Text> da contracapa dos autos, bem como de qualquer outro meio de intimação do processo, sendo assim que <Text style={styles.bold}>todas as futuras intimações passem a ser exclusivamente dirigidas ao substabelecido</Text>, <Text style={styles.bold}>{advogadoSubstabelecido}</Text> sob <Text style={styles.bold}>{oabSubstabelecidoCurta}</Text>, nos termos do artigo 272, §5º, do CPC, sob pena de nulidade.
          </Text>
        </View>

        <Text style={styles.dateArea}>{cidadeComarca}, {dataFormatada}</Text>

        <View style={styles.signatureArea}>
          <View style={styles.signatureBlock}>
            <View style={styles.line} />
            <Text style={styles.bold}>{advogadoSubstabelecente}</Text>
            <Text style={styles.bold}>{oabSubstabelecenteCurta}</Text>
          </View>

          <View style={styles.signatureBlock}>
            <View style={styles.line} />
            <Text style={styles.bold}>{advogadoSubstabelecido}</Text>
            <Text style={styles.bold}>{oabSubstabelecidoCurta}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
