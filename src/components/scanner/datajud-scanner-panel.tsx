
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
    padding: '40mm 25mm',
    fontFamily: 'Times-Roman',
    fontSize: 12,
    lineHeight: 1.8,
    textAlign: 'justify',
    color: '#000000'
  },
  title: {
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 13,
    marginBottom: 40,
    textDecoration: 'underline',
    textTransform: 'uppercase'
  },
  paragraph: {
    marginBottom: 40,
    textIndent: 50,
  },
  bold: {
    fontWeight: 'bold'
  },
  dateArea: {
    marginTop: 40,
    marginBottom: 80,
    textAlign: 'center',
  },
  signatureArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginTop: 20,
  },
  line: {
    width: '60%',
    borderTop: '1pt solid black',
    marginBottom: 5,
  }
});

export function SubstabelecimentoSimplesPDF({ data }: { data: any }) {
  const { 
    substabelecente, 
    substabelecido, 
    numeroProcesso, 
    parteNome,
    cidadeData 
  } = data;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>SUBSTABELECIMENTO SEM RESERVA DE PODERES</Text>

        <View style={styles.paragraph}>
          <Text>
            Pelo presente instrumento, <Text style={styles.bold}>Dr. {substabelecente.nome}</Text>, advogado regularmente inscrito na <Text style={styles.bold}>{substabelecente.oabCompleta}</Text>, substabelece, <Text style={styles.bold}>SEM RESERVA DE PODERES</Text>, ao <Text style={styles.bold}>Dr. {substabelecido.nome}</Text>, advogado inscrito na <Text style={styles.bold}>{substabelecido.oabCompleta}</Text>, todos os poderes que lhe foram conferidos nos autos do processo nº <Text style={styles.bold}>{numeroProcesso}</Text>, para que represente os interesses da parte <Text style={styles.bold}>{parteNome}</Text>.
          </Text>
        </View>

        <Text style={styles.dateArea}>{cidadeData}</Text>

        <View style={styles.signatureArea}>
          <View style={styles.line} />
          <Text style={styles.bold}>{substabelecente.nome.toUpperCase()}</Text>
          <Text style={styles.bold}>{substabelecente.oabCurta}</Text>
        </View>
      </Page>
    </Document>
  );
}
