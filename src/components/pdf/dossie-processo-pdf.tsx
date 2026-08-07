/**
 * Dossiê individual do processo — defesa da operação + relação com o cliente.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: 'Helvetica', color: '#0f172a' },
  header: {
    backgroundColor: '#0f172a',
    color: '#fff',
    padding: 14,
    marginBottom: 16,
  },
  h1: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  h2: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginTop: 12,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 3,
  },
  row: { flexDirection: 'row', marginBottom: 3 },
  label: { width: '32%', color: '#64748b', fontFamily: 'Helvetica-Bold' },
  value: { width: '68%' },
  box: {
    backgroundColor: '#f8fafc',
    padding: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  warn: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    padding: 8,
    marginBottom: 8,
  },
  ok: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    padding: 8,
    marginBottom: 8,
  },
  small: { fontSize: 8, color: '#475569', lineHeight: 1.4 },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 36,
    right: 36,
    fontSize: 7,
    color: '#94a3b8',
    textAlign: 'center',
  },
});

export type DossieProcessoData = {
  geradoEm: string;
  cliente: string;
  protocolo: string;
  tribunal?: string;
  advogado?: string;
  escritorio?: string;
  telefone?: string;
  status?: string;
  ultimoRetorno?: string;
  proximoPrazo?: string;
  observacao?: string;
  datajudUltimo?: string;
  datajudNome?: string;
  djenResumo?: string;
  djenLink?: string;
  flags: {
    novidade?: boolean;
    atendidoSemana?: boolean;
    semanaLabel?: string;
    baixa?: boolean;
    ba?: boolean;
    baTipo?: string | null;
    baRelacionada?: boolean;
    penhora?: boolean;
    penhoraRelacionada?: boolean;
    audiencia?: boolean;
    cumprimento?: boolean;
    custas?: boolean;
    procedente?: boolean;
    improcedente?: boolean;
  };
  tempoRespostaDias?: number | null;
  analiseClaude?: string | null;
  movimentos?: Array<{ data?: string; nome?: string }>;
  comunicacoes?: Array<{ data?: string; resumo?: string }>;
  narrativaOperacional?: string;
  narrativaCliente?: string;
};

function Line({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

export function DossieProcessoPDF({ data }: { data: DossieProcessoData }) {
  const f = data.flags || {};
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.h1}>Dossiê Operacional do Processo</Text>
          <Text style={{ fontSize: 8, color: '#cbd5e1' }}>
            Defesa da operação · Relação com o cliente · Gerado em {data.geradoEm}
          </Text>
        </View>

        <Text style={styles.h2}>Identificação</Text>
        <View style={styles.box}>
          <Line label="Cliente" value={data.cliente} />
          <Line label="CNJ" value={data.protocolo} />
          <Line label="Tribunal" value={data.tribunal} />
          <Line label="Advogado" value={data.advogado} />
          <Line label="Escritório" value={data.escritorio} />
          <Line label="Telefone" value={data.telefone} />
          <Line label="Status interno" value={data.status} />
          <Line label="Último retorno" value={data.ultimoRetorno} />
          <Line label="Próximo prazo" value={data.proximoPrazo} />
          <Line
            label="Tempo s/ retorno"
            value={
              data.tempoRespostaDias != null
                ? `${data.tempoRespostaDias} dia(s)`
                : undefined
            }
          />
        </View>

        <Text style={styles.h2}>Sinais operacionais</Text>
        <View style={f.ba || f.penhora ? styles.warn : styles.box}>
          <Text style={styles.small}>
            Novidade: {f.novidade ? 'SIM' : 'não'} · Baixa tribunal:{' '}
            {f.baixa ? 'SIM' : 'não'} · Cumprimento: {f.cumprimento ? 'SIM' : 'não'} ·
            Custas: {f.custas ? 'SIM' : 'não'} · Audiência designada:{' '}
            {f.audiencia ? 'SIM' : 'não'}
          </Text>
          <Text style={styles.small}>
            Sentença: {f.procedente ? 'procedente' : f.improcedente ? 'improcedente' : '—'}
          </Text>
          {f.ba && f.baRelacionada ? (
            <Text style={styles.small}>
              B.A. relacionada ao processo/dívida: SIM ({f.baTipo || 'tipo n/d'})
            </Text>
          ) : f.ba ? (
            <Text style={styles.small}>
              Indício B.A. — validar vínculo com este CNJ antes de alarmar o cliente
            </Text>
          ) : (
            <Text style={styles.small}>Busca e apreensão: não</Text>
          )}
          {f.penhora && f.penhoraRelacionada ? (
            <Text style={styles.small}>Penhora de bens relacionada: SIM</Text>
          ) : null}
        </View>

        <Text style={styles.h2}>Tribunal (DataJud)</Text>
        <View style={styles.box}>
          <Line label="Último movimento" value={data.datajudNome} />
          <Line label="Data" value={data.datajudUltimo} />
          {(data.movimentos || []).slice(0, 8).map((m, i) => (
            <Text key={i} style={styles.small}>
              · {m.data || '—'} — {m.nome || 'movimento'}
            </Text>
          ))}
        </View>

        <Text style={styles.h2}>Diário Oficial (DJEN)</Text>
        <View style={styles.box}>
          <Line label="Resumo" value={data.djenResumo} />
          <Line label="Link" value={data.djenLink} />
          {(data.comunicacoes || []).slice(0, 5).map((c, i) => (
            <Text key={i} style={styles.small}>
              · {c.data || '—'} — {(c.resumo || '').slice(0, 160)}
            </Text>
          ))}
        </View>

        {data.flags?.atendidoSemana ? (
          <View style={styles.ok}>
            <Text style={styles.h2}>Atendimento nesta semana</Text>
            <Text style={styles.small}>Último retorno registrado dentro da semana operacional ({data.flags.semanaLabel || 'semana atual'}).</Text>
          </View>
        ) : null}

        {data.analiseClaude ? (
          <>
            <Text style={styles.h2}>Análise assistida (Claude / OmniRoute)</Text>
            <View style={styles.box}>
              <Text style={styles.small}>{data.analiseClaude}</Text>
            </View>
          </>
        ) : null}

        <Text style={styles.h2}>Narrativa operacional (defesa da empresa)</Text>
        <View style={styles.ok}>
          <Text style={styles.small}>
            {data.narrativaOperacional ||
              'Equipe monitora tribunal e diário; retornos registrados; pendências priorizadas na fila.'}
          </Text>
        </View>

        <Text style={styles.h2}>Relação com o cliente</Text>
        <View style={styles.box}>
          <Text style={styles.small}>
            {data.narrativaCliente ||
              'Comunicação objetiva, sem juridiquês; validação humana antes de qualquer orientação definitiva.'}
          </Text>
          {data.observacao ? (
            <Text style={{ ...styles.small, marginTop: 6 }}>
              Observações do gabinete: {data.observacao}
            </Text>
          ) : null}
        </View>

        <Text style={styles.footer}>
          Documento interno · LexisPredict · Não substitui parecer jurídico formal ·{' '}
          {data.protocolo}
        </Text>
      </Page>
    </Document>
  );
}
