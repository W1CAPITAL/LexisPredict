/**
 * PDF genérico de peça jurídica — renderiza qualquer texto formatado
 * (petições, cartas, procurações, minutas) em layout A4 profissional.
 * Usado por Modelos & Peças, Jurídico e Cadastro (ia-sync).
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved. See LICENSE file.
 */
import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    paddingTop: 46,
    paddingBottom: 64,
    paddingHorizontal: 52,
    backgroundColor: '#ffffff',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  brand: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 12,
    letterSpacing: 2,
    color: '#111111',
    textTransform: 'uppercase',
  },
  badge: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
    letterSpacing: 1,
    color: '#8a6d1f',
    textTransform: 'uppercase',
  },
  rule: {
    borderBottomWidth: 1,
    borderBottomColor: '#c9c2ae',
    marginBottom: 22,
  },
  titulo: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    color: '#111111',
    textTransform: 'uppercase',
  },
  sub: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    textAlign: 'center',
    color: '#555555',
    marginBottom: 20,
  },
  body: {
    fontFamily: 'Helvetica',
    fontSize: 10.5,
    lineHeight: 1.65,
    color: '#111111',
    textAlign: 'justify',
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 52,
    right: 52,
    borderTopWidth: 1,
    borderTopColor: '#c9c2ae',
    paddingTop: 7,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontFamily: 'Helvetica',
    fontSize: 7,
    color: '#777777',
  },
});

export function PecaTextoPDF({ data }: { data: { titulo?: string; sub?: string; texto: string } }) {
  const titulo = data?.titulo || 'PEÇA JURÍDICA';
  const sub = data?.sub || '';
  const texto = String(data?.texto || '');

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.brandRow}>
          <Text style={styles.brand}>LexisPredict</Text>
          <Text style={styles.badge}>Documento gerado eletronicamente</Text>
        </View>
        <View style={styles.rule} />

        <Text style={styles.titulo}>{titulo}</Text>
        {sub ? <Text style={styles.sub}>{sub}</Text> : null}

        <Text style={styles.body}>{texto}</Text>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            LexisPredict · confira os dados antes do peticionamento — documento não substitui
            certidão oficial
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
            fixed
          />
        </View>
      </Page>
    </Document>
  );
}
