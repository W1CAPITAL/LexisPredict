/**
 * PDF de peça jurídica — layout A4 profissional (margens, parágrafos, assinatura).
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */
import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingBottom: 72,
    paddingHorizontal: 64,
    backgroundColor: '#ffffff',
    fontFamily: 'Times-Roman',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  brand: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    letterSpacing: 1.5,
    color: '#444444',
    textTransform: 'uppercase',
  },
  badge: {
    fontFamily: 'Helvetica',
    fontSize: 7,
    letterSpacing: 0.5,
    color: '#8a6d1f',
    textTransform: 'uppercase',
  },
  rule: {
    borderBottomWidth: 1.5,
    borderBottomColor: '#1a1a1a',
    marginBottom: 20,
  },
  titulo: {
    fontFamily: 'Times-Bold',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 6,
    color: '#111111',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sub: {
    fontFamily: 'Times-Roman',
    fontSize: 9,
    textAlign: 'center',
    marginBottom: 16,
    color: '#555555',
  },
  para: {
    fontFamily: 'Times-Roman',
    fontSize: 11,
    lineHeight: 1.55,
    textAlign: 'justify',
    color: '#111111',
    marginBottom: 10,
  },
  paraCenter: {
    fontFamily: 'Times-Bold',
    fontSize: 11,
    lineHeight: 1.5,
    textAlign: 'center',
    color: '#111111',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  paraSign: {
    fontFamily: 'Times-Roman',
    fontSize: 11,
    lineHeight: 1.5,
    textAlign: 'center',
    color: '#111111',
    marginTop: 8,
    marginBottom: 4,
  },
  lineSign: {
    marginTop: 28,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
    width: 220,
    alignSelf: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 28,
    left: 64,
    right: 64,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 0.5,
    borderTopColor: '#cccccc',
    paddingTop: 6,
  },
  footerText: {
    fontFamily: 'Helvetica',
    fontSize: 7,
    color: '#888888',
  },
});

function isTitleLine(line: string): boolean {
  const s = line.trim();
  if (!s) return false;
  if (s === s.toUpperCase() && s.length < 80 && !s.endsWith('.')) return true;
  return false;
}

function isSignBlock(line: string): boolean {
  const s = line.trim();
  if (!s) return false;
  if (/^_{5,}/.test(s)) return true;
  if (/^OAB\//i.test(s)) return true;
  return false;
}

export function PecaTextoPDF({
  data,
}: {
  data: { titulo?: string; sub?: string; texto: string };
}) {
  const titulo = (data?.titulo || 'PEÇA JURÍDICA').trim();
  const sub = (data?.sub || '').trim();
  const raw = String(data?.texto || '').replace(/\r\n/g, '\n').trim();

  // Divide em blocos por linha em branco
  const blocks = raw
    ? raw.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean)
    : [];

  // Se veio tudo em uma linha só com \n simples, usa linhas
  const lines =
    blocks.length <= 1 && raw.includes('\n')
      ? raw.split('\n').map((l) => l.trim())
      : null;

  const renderLines = (arr: string[]) =>
    arr.map((line, i) => {
      if (!line) return <View key={i} style={{ height: 8 }} />;
      if (/^_{5,}/.test(line)) {
        return <View key={i} style={styles.lineSign} />;
      }
      if (isTitleLine(line) && i < 3) {
        return (
          <Text key={i} style={styles.paraCenter}>
            {line}
          </Text>
        );
      }
      if (isSignBlock(line) || (i > arr.length - 5 && line === line.toUpperCase() && line.length < 60)) {
        return (
          <Text key={i} style={styles.paraSign}>
            {line}
          </Text>
        );
      }
      return (
        <Text key={i} style={styles.para}>
          {line}
        </Text>
      );
    });

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

        {lines
          ? renderLines(lines)
          : blocks.map((block, i) => {
              const first = block.split('\n')[0]?.trim() || '';
              if (isTitleLine(first) && block.split('\n').length === 1) {
                return (
                  <Text key={i} style={styles.paraCenter}>
                    {first}
                  </Text>
                );
              }
              return (
                <Text key={i} style={styles.para}>
                  {block.replace(/\n/g, ' ')}
                </Text>
              );
            })}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            LexisPredict · confira os dados antes do peticionamento — não substitui certidão oficial
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
