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
    lineHeight: 1.6,
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
    textIndent: 40
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
            O <Text style={styles.bold}>{substabelecente.nome.toUpperCase()}</Text>, {substabelecente.nacionalidade || 'brasileiro'}, {substabelecente.estadoCivil || 'casado'}, advogado, inscrito na <Text style={styles.bold}>{substabelecente.oabCompleta}</Text>, <Text style={styles.bold}>SUBSTABELECE SEM RESERVA DE PODERES</Text> na pessoa do <Text style={styles.bold}>{substabelecido.nome.toUpperCase()}</Text>, {substabelecido.nacionalidade || 'brasileiro'}, {substabelecido.estadoCivil || 'casado'}, inscrito na <Text style={styles.bold}>{substabelecido.oabCompleta}</Text>, os poderes conferidos por <Text style={styles.bold}>{cliente.nome.toUpperCase()}</Text>, <Text style={styles.bold}>PARA A PROMOÇÃO DE {processo.acao.toUpperCase()}</Text> {includeBankInfo ? `promovida contra o ${processo.banco.toUpperCase()}, inscrito no CNPJ sob o nº ${processo.cnpjBanco || '---'}` : ""}{includeProcessNumber ? `, processo de n.º ${processo.numero}` : ""} por meio do instrumento outrora outorgado, requerendo a exclusão do advogado substabelecente <Text style={styles.bold}>{substabelecente.nome.toUpperCase()}</Text> sob <Text style={styles.bold}>{substabelecente.oabCurta}</Text> da contracapa dos autos, bem como de qualquer outro meio de intimação do processo, sendo assim que <Text style={styles.bold}>todas as futuras intimações passsem a ser exclusivamente dirigidas ao substabelecido</Text>, <Text style={styles.bold}>{substabelecido.nome.toUpperCase()}</Text> sob <Text style={styles.bold}>{substabelecido.oabCurta}</Text>, nos termos do artigo 272, §5º, do CPC, sob pena de nulidade.
          </Text>
        </View>

        <Text style={styles.date}>{comarca}, {dataExtenso}</Text>

        {/* Assinatura do Substabelecente */}
        <View style={styles.signatureArea}>
          <View style={styles.signatureLine} />
          <Text style={styles.bold}>{substabelecente.nome.toUpperCase()}</Text>
          <Text style={styles.bold}>{substabelecente.oabCurta}</Text>
        </View>

        {/* Espaçamento entre assinaturas */}
        <View style={{ marginTop: 40 }} />

        {/* Assinatura do Substabelecido */}
        <View style={styles.signatureArea}>
          <View style={styles.signatureLine} />
          <Text style={styles.bold}>{substabelecido.nome.toUpperCase()}</Text>
          <Text style={styles.bold}>{substabelecido.oabCurta}</Text>
        </View>
      </Page>
    </Document>
  );
}
