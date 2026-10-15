import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    paddingTop: 85,
    paddingLeft: 85,
    paddingRight: 57,
    paddingBottom: 57,
    fontFamily: 'Times-Roman',
    fontSize: 12,
    lineHeight: 1.5,
    textAlign: 'justify',
    color: '#000000'
  },
  title: {
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 20,
    textTransform: 'uppercase'
  },
  subtitle: {
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 12,
    marginBottom: 40
  },
  paragraph: {
    marginBottom: 15,
    textIndent: 36
  },
  bold: {
    fontWeight: 'bold'
  },
  date: {
    textAlign: 'center',
    marginTop: 50,
    marginBottom: 60
  },
  signatureArea: {
    textAlign: 'center',
    marginTop: 20,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  signatureLine: {
    width: '60%',
    borderTop: '1pt solid black',
    alignSelf: 'center',
    marginBottom: 8
  }
});

export function SubstabelecimentoPDF({ data }: { data: any }) {
  const { 
    substabelecente, 
    substabelecido, 
    cliente, 
    processo, 
    comarca, 
    dataExtenso,
    includeBankInfo,
    includeProcessNumber
  } = data;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>SUBSTABELECIMENTO</Text>
        <Text style={styles.subtitle}>(sem reserva de poderes)</Text>
        
        <View style={styles.paragraph}>
          <Text>
            O <Text style={styles.bold}>{substabelecente.nome.toUpperCase()}</Text>, {substabelecente.nacionalidade || ''}, {substabelecente.estadoCivil || ''}, advogado, inscrito na <Text style={styles.bold}>{substabelecente.oabCompleta}</Text>, <Text style={styles.bold}>SUBSTABELECE SEM RESERVA DE PODERES</Text> na pessoa do <Text style={styles.bold}>{substabelecido.nome.toUpperCase()}</Text>, {substabelecido.nacionalidade || ''}, {substabelecido.estadoCivil || ''}, inscrito na <Text style={styles.bold}>{substabelecido.oabCompleta}</Text>, os poderes conferidos por <Text style={styles.bold}>{cliente.nome.toUpperCase()}</Text>, <Text style={styles.bold}>PARA A PROMOÇÃO DE {processo.acao.toUpperCase()}</Text> {includeBankInfo ? `promovida contra o ${processo.banco.toUpperCase()}, inscrito no CNPJ sob o nº ${processo.cnpjBanco || '---'}` : ""}{includeProcessNumber ? `, processo de n.º ${processo.numero}` : ""} nos limites do mandato originário, conforme o instrumento de procuração que fundamenta a representação.
          </Text>
        </View>

        <Text style={styles.date}>{comarca}, {dataExtenso}</Text>

        {/* Assinatura do Substabelecente */}
        <View style={styles.signatureArea}>
          <View style={styles.signatureLine} />
          <Text style={styles.bold}>{substabelecente.nome.toUpperCase()}</Text>
          <Text style={styles.bold}>{substabelecente.oabCurta}</Text>
        </View>

      </Page>
    </Document>
  );
}
