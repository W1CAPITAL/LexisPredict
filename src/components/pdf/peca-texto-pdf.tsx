/**
 * PDF de peça — formatação próxima ao modelo profissional:
 * margens ~3cm sup/esq, ~2cm inf/dir; corpo justificado; seções em destaque;
 * espaçamento 1,5; assinatura centralizada.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */
import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';

// 1cm ≈ 28.35pt → 3cm≈85, 2cm≈57
const styles = StyleSheet.create({
  page: {
    paddingTop: 85,
    paddingLeft: 85,
    paddingBottom: 64,
    paddingRight: 57,
    backgroundColor: '#ffffff',
    fontFamily: 'Helvetica',
  },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  brand: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    letterSpacing: 1.2,
    color: '#555555',
    textTransform: 'uppercase',
  },
  badge: {
    fontFamily: 'Helvetica',
    fontSize: 7,
    color: '#8a6d1f',
    textTransform: 'uppercase',
  },
  rule: {
    borderBottomWidth: 1.25,
    borderBottomColor: '#111111',
    marginBottom: 28,
  },
  titulo: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
    color: '#111111',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sub: {
    fontFamily: 'Helvetica-Oblique',
    fontSize: 10,
    textAlign: 'center',
    marginBottom: 16,
    color: '#333333',
  },
  para: {
    fontFamily: 'Helvetica',
    fontSize: 12,
    lineHeight: 1.5,
    textAlign: 'justify',
    color: '#111111',
    marginBottom: 12,
    textIndent: 48,
  },
  paraNoIndent: {
    fontFamily: 'Helvetica',
    fontSize: 12,
    lineHeight: 1.5,
    textAlign: 'justify',
    color: '#111111',
    marginBottom: 12,
  },
  labelLine: {
    fontFamily: 'Helvetica',
    fontSize: 12,
    lineHeight: 1.5,
    textAlign: 'justify',
    color: '#111111',
    marginBottom: 12,
  },
  labelBold: {
    fontFamily: 'Helvetica-Bold',
  },
  titleLine: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 12,
    lineHeight: 1.5,
    textAlign: 'center',
    textTransform: 'uppercase',
    marginBottom: 14,
    color: '#111111',
  },
  localData: {
    fontFamily: 'Helvetica',
    fontSize: 12,
    lineHeight: 1.5,
    textAlign: 'left',
    marginTop: 18,
    marginBottom: 28,
    color: '#111111',
  },
  signBlock: {
    marginTop: 24,
    marginBottom: 8,
    alignItems: 'center',
  },
  signLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
    width: 240,
    marginBottom: 6,
  },
  signName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    textAlign: 'center',
    color: '#111111',
  },
  signRole: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    textAlign: 'center',
    color: '#111111',
    marginTop: 2,
  },
  footer: {
    position: 'absolute',
    bottom: 28,
    left: 85,
    right: 57,
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

const LABEL_RE =
  /^(Outorgante|Outorgado\(s\)|Outorgado|Objeto|Poderes|Poderes Excepcionais|Poderes Específicos|Finalidade|Substabelecente|Substabelecido|Notificante|Proponente|Reclamante|Reclamado|DOS FATOS|DO DIREITO|DOS PEDIDOS|PROPOSTA|REF\.|Observações)\s*:/i;

function isMainTitle(line: string): boolean {
  const s = line.trim();
  if (!s || s.length > 90) return false;
  if (s !== s.toUpperCase()) return false;
  if (s.endsWith('.')) return false;
  return true;
}

function isLocalData(line: string): boolean {
  const s = line.trim();
  // 24/08/2026 ou "São Paulo - SP, 24 de agosto de 2026."
  if (/,\s*\d{1,2}\/\d{1,2}\/\d{4}\.?$/.test(s)) return true;
  if (/\d{1,2}\s+de\s+[a-zçãéôõáíú]+\s+de\s+\d{4}\.?$/i.test(s)) return true;
  if (/^\[CIDADE\]/i.test(s)) return true;
  return false;
}

function isSignRole(line: string): boolean {
  return /^(Outorgante|Proponente|Notificante|Requerente|Substabelecente)$/i.test(line.trim());
}

function isSignName(line: string, index: number, total: number): boolean {
  // Assinatura só no final do documento
  if (index < total - 8) return false;
  const s = line.trim();
  if (/^_{5,}/.test(s)) return true;
  if (
    s === s.toUpperCase() &&
    s.length > 3 &&
    s.length < 80 &&
    !s.includes('OAB') &&
    !/REVOGA/i.test(s) &&
    !/PROCURA/i.test(s) &&
    !/HABILITA/i.test(s) &&
    !/SUBSTABELE/i.test(s) &&
    !/NOTIFICA/i.test(s) &&
    !/PETIÇÃO/i.test(s)
  ) {
    return true;
  }
  if (isSignRole(s)) return true;
  if (/^OAB\//i.test(s)) return true;
  return false;
}

export function PecaTextoPDF({
  data,
}: {
  data: { titulo?: string; sub?: string; texto: string };
}) {
  const tituloDoc = (data?.titulo || 'PEÇA JURÍDICA').trim();
  const sub = (data?.sub || '').trim();
  const raw = String(data?.texto || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  const lines = raw ? raw.split('\n').map((l) => l.trimEnd()) : [];

  const nodes: React.ReactNode[] = [];
  let i = 0;
  const n = lines.length;

  while (i < n) {
    const line = lines[i].trim();
    if (!line) {
      i++;
      continue;
    }

    // Bloco de assinatura: _____ + nome + cargo (centralizado)
    if (/^_{5,}/.test(line)) {
      const name = (lines[i + 1] || '').trim();
      const role = (lines[i + 2] || '').trim();
      const hasName = !!(name && !/^_{5,}/.test(name) && !isSignRole(name));
      const hasRole = !!(role && isSignRole(role));

      nodes.push(
        <View key={`s-${i}`} style={styles.signBlock} wrap={false}>
          <View style={styles.signLine} />
          {hasName ? <Text style={styles.signName}>{name}</Text> : null}
          {hasRole ? <Text style={styles.signRole}>{role}</Text> : null}
        </View>
      );

      i += 1; // consome _____
      if (hasName) i += 1;
      if (hasRole) i += 1;
      continue;
    }

    if (isMainTitle(line) && i < 6) {
      nodes.push(
        <Text key={`t-${i}`} style={styles.titleLine}>
          {line}
        </Text>
      );
      i++;
      continue;
    }

    if (isLocalData(line)) {
      nodes.push(
        <Text key={`d-${i}`} style={styles.localData}>
          {line}
        </Text>
      );
      i++;
      continue;
    }

    if (isSignName(line, i, n)) {
      const roleLike = isSignRole(line);
      const oabLike = /^OAB\//i.test(line);
      nodes.push(
        <Text
          key={`n-${i}`}
          style={roleLike || oabLike ? styles.signRole : styles.signName}
        >
          {line}
        </Text>
      );
      i++;
      continue;
    }

    const labelMatch = line.match(LABEL_RE);
    if (labelMatch) {
      const label = labelMatch[1];
      const rest = line.slice(labelMatch[0].length).trim();
      nodes.push(
        <Text key={`l-${i}`} style={styles.labelLine}>
          <Text style={styles.labelBold}>{label}: </Text>
          {rest}
        </Text>
      );
      i++;
      continue;
    }

    // Lista a) b) c) ou "Requer:"
    if (/^[a-c]\)\s/.test(line) || /^Requer:$/i.test(line)) {
      nodes.push(
        <Text key={`p-${i}`} style={styles.paraNoIndent}>
          {line}
        </Text>
      );
      i++;
      continue;
    }

    nodes.push(
      <Text key={`p-${i}`} style={styles.para}>
        {line}
      </Text>
    );
    i++;
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.brandRow}>
          <Text style={styles.brand}>LexisPredict</Text>
          <Text style={styles.badge}>Documento gerado eletronicamente</Text>
        </View>
        <View style={styles.rule} />

        <Text style={styles.titulo}>{tituloDoc}</Text>
        {sub ? <Text style={styles.sub}>{sub}</Text> : null}

        {nodes}

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
