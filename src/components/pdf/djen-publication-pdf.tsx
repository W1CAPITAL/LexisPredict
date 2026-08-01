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
    lineHeight: 1.5,
    textAlign: 'justify',
    color: '#000000'
  },
  header: {
    marginBottom: 30,
    borderBottom: '1pt solid black',
    paddingBottom: 10,
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  meta: {
    fontSize: 9,
    color: '#333333',
    marginBottom: 4,
    textTransform: 'uppercase',
    fontWeight: 'bold',
  },
  content: {
    marginTop: 20,
    whiteSpace: 'pre-wrap',
  },
  footer: {
    marginTop: 40,
    paddingTop: 10,
    borderTop: '0.5pt solid #cccccc',
    fontSize: 8,
    textAlign: 'center',
    color: '#666666',
    textTransform: 'uppercase',
  }
});

export function DjenPublicationPDF({ data }: { data: any }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{data.titulo || "PUBLICAÇÃO OFICIAL"}</Text>
          <Text style={styles.meta}>PROCESSO: {data.protocolo}</Text>
          <Text style={styles.meta}>DATA DISPONIBILIZAÇÃO: {data.data}</Text>
          <Text style={styles.meta}>ÓRGÃO: {data.orgao}</Text>
          <Text style={styles.meta}>TIPO: {data.tipo}</Text>
        </View>
        <View style={styles.content}>
          <Text>{data.texto}</Text>
        </View>
        <View style={styles.footer}>
          <Text>LexisPredict Elite • Documento gerado em {new Date().toLocaleString('pt-BR')}</Text>
          <Text>Fonte: Diário de Justiça Eletrônico Nacional (DJEN)</Text>
        </View>
      </Page>
    </Document>
  );
}