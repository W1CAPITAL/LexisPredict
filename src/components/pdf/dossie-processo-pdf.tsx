/**
 * Dossiê individual do processo — defesa da operação + relação com o cliente.
 * Visual v2: capa premium, badges de sinais, blocos estruturados e rodapé de auditoria.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const C = {
  ink: '#0B1220',
  body: '#1e293b',
  muted: '#64748b',
  faint: '#94a3b8',
  line: '#e2e8f0',
  soft: '#f8fafc',
  brand: '#164e63',
  brandLight: '#e0f2fe',
  danger: '#dc2626',
  dangerSoft: '#fef2f2',
  warn: '#d97706',
  warnSoft: '#fffbeb',
  ok: '#059669',
  okSoft: '#ecfdf5',
  white: '#ffffff',
} as const;

const styles = StyleSheet.create({
  page: {
    paddingTop: 0,
    paddingBottom: 46,
    paddingHorizontal: 0,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: C.body,
    backgroundColor: C.white,
  },
  headerBand: {
    backgroundColor: C.brand,
    paddingTop: 18,
    paddingBottom: 16,
    paddingHorizontal: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandName: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: C.white, letterSpacing: 2 },
  brandSub: { fontSize: 6.5, color: '#a5f3fc', marginTop: 3, letterSpacing: 0.6 },
  confBadge: {
    fontSize: 6.5,
    color: C.white,
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    letterSpacing: 0.6,
  },
  titleBlock: {
    paddingHorizontal: 36,
    paddingTop: 20,
    paddingBottom: 12,
    backgroundColor: C.soft,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  kicker: { fontSize: 7, color: C.muted, fontFamily: 'Helvetica-Bold', letterSpacing: 1.1 },
  h1: { fontSize: 17, fontFamily: 'Helvetica-Bold', color: C.ink, marginTop: 4, marginBottom: 6 },
  meta: { fontSize: 7.5, color: C.muted, marginTop: 2, letterSpacing: 0.2 },
  statusChipRow: { flexDirection: 'row', gap: 6, marginTop: 12, flexWrap: 'wrap' },
  chip: {
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 999,
    borderWidth: 1,
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.5,
  },
  chipGray: { backgroundColor: '#f1f5f9', borderColor: '#cbd5e1', color: '#334155' },
  chipRed: { backgroundColor: C.dangerSoft, borderColor: '#fca5a5', color: C.danger },
  chipAmber: { backgroundColor: C.warnSoft, borderColor: '#fcd34d', color: C.warn },
  chipGreen: { backgroundColor: C.okSoft, borderColor: '#a7f3d0', color: C.ok },
  chipBlue: { backgroundColor: C.brandLight, borderColor: '#93c5fd', color: C.brand },
  content: { paddingHorizontal: 36, paddingTop: 16 },
  h2: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: C.ink,
    marginTop: 14,
    marginBottom: 6,
    borderBottomWidth: 1.2,
    borderBottomColor: C.brand,
    paddingBottom: 4,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  grid: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  col: { flex: 1 },
  box: {
    backgroundColor: C.soft,
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.line,
  },
  boxOk: {
    backgroundColor: C.okSoft,
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  boxWarn: {
    backgroundColor: C.warnSoft,
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fcd34d',
  },
  boxDanger: {
    backgroundColor: C.dangerSoft,
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  lineLabel: { width: '34%', color: C.faint, fontFamily: 'Helvetica-Bold', fontSize: 6.8, letterSpacing: 0.3 },
  lineValue: { width: '66%', fontSize: 7.6, color: C.body },
  row: { flexDirection: 'row', marginBottom: 3 },
  small: { fontSize: 7.2, color: C.body, lineHeight: 1.55 },
  tiny: { fontSize: 6.4, color: C.muted, lineHeight: 1.5 },
  sectionNote: {
    fontSize: 6.4,
    color: C.muted,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 36,
    right: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingTop: 6,
  },
  footerText: { fontSize: 6.2, color: C.faint, letterSpacing: 0.3 },
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
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={styles.lineValue}>{value}</Text>
    </View>
  );
}

function Chip({ label, tone }: { label: string; tone: 'gray' | 'red' | 'amber' | 'green' | 'blue' }) {
  const map = {
    gray: styles.chipGray,
    red: styles.chipRed,
    amber: styles.chipAmber,
    green: styles.chipGreen,
    blue: styles.chipBlue,
  };
  return <Text style={[styles.chip, map[tone]]}>{label}</Text>;
}

export function DossieProcessoPDF({ data }: { data: DossieProcessoData }) {
  const f = data.flags || {};
  const chips: { label: string; tone: 'gray' | 'red' | 'amber' | 'green' | 'blue' }[] = [];
  if (f.ba) chips.push({ label: f.baRelacionada ? 'B.A. VINCULADA' : 'INDÍCIO B.A.', tone: 'red' });
  if (f.penhora) chips.push({ label: 'PENHORA', tone: 'red' });
  if (f.baixa) chips.push({ label: 'BAIXA TRIBUNAL', tone: 'amber' });
  if (f.cumprimento) chips.push({ label: 'CUMPRIMENTO', tone: 'amber' });
  if (f.custas) chips.push({ label: 'CUSTAS', tone: 'amber' });
  if (f.audiencia) chips.push({ label: 'AUDIÊNCIA', tone: 'blue' });
  if (f.novidade) chips.push({ label: 'NOVIDADE', tone: 'blue' });
  if (f.atendidoSemana) chips.push({ label: 'ATENDIDO NA SEMANA', tone: 'green' });
  if (f.procedente) chips.push({ label: 'SENTENÇA PROCEDENTE', tone: 'green' });
  if (f.improcedente) chips.push({ label: 'SENTENÇA IMPROCEDENTE', tone: 'red' });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerBand}>
          <View>
            <Text style={styles.brandName}>LEXISPREDICT</Text>
            <Text style={styles.brandSub}>DOCUMENTO INTERNO • USO OPERACIONAL CONTROLADO</Text>
          </View>
          <Text style={styles.confBadge}>CONFIDENCIAL</Text>
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.kicker}>DOSSIÊ DE PROCESSO</Text>
          <Text style={styles.h1}>{data.cliente || 'Cliente'}</Text>
          <Text style={styles.meta}>
            Protocolo CNJ: {data.protocolo} · Tribunal do processo: {data.tribunal || 'S/D'} · Gerado em{' '}
            {data.geradoEm}
          </Text>
          {chips.length > 0 && (
            <View style={styles.statusChipRow}>
              {chips.map((c) => (
                <Chip key={c.label} label={c.label} tone={c.tone} />
              ))}
            </View>
          )}
        </View>

        <View style={styles.content}>
          {/* Identificação */}
          <Text style={styles.h2}>Identificação</Text>
          <View style={styles.box}>
            <View style={styles.grid}>
              <View style={styles.col}>
                <Line label="Cliente" value={data.cliente} />
                <Line label="CNJ" value={data.protocolo} />
                <Line label="Tribunal" value={data.tribunal} />
                <Line label="Advogado" value={data.advogado} />
              </View>
              <View style={styles.col}>
                <Line label="Escritório" value={data.escritorio} />
                <Line label="Telefone" value={data.telefone} />
                <Line label="Status interno" value={data.status} />
                <Line label="Último retorno" value={data.ultimoRetorno} />
              </View>
            </View>
            <View style={styles.grid}>
              <View style={styles.col}>
                <Line label="Próximo prazo" value={data.proximoPrazo} />
              </View>
              <View style={styles.col}>
                <Line
                  label="Tempo s/ retorno"
                  value={data.tempoRespostaDias != null ? `${data.tempoRespostaDias} dia(s)` : undefined}
                />
              </View>
            </View>
          </View>

          {/* Sinais operacionais */}
          <Text style={styles.h2}>Sinais operacionais</Text>
          <View style={f.ba || f.penhora ? styles.boxDanger : styles.box}>
            <View style={styles.grid}>
              <View style={styles.col}>
                <Text style={styles.tiny}>NOVIDADE</Text>
                <Text style={styles.small}>{f.novidade ? 'SIM' : 'Não'}</Text>
              </View>
              <View style={styles.col}>
                <Text style={styles.tiny}>CUSTAS</Text>
                <Text style={styles.small}>{f.custas ? 'SIM' : 'Não'}</Text>
              </View>
              <View style={styles.col}>
                <Text style={styles.tiny}>CUMPRIMENTO</Text>
                <Text style={styles.small}>{f.cumprimento ? 'SIM' : 'Não'}</Text>
              </View>
              <View style={styles.col}>
                <Text style={styles.tiny}>AUDIÊNCIA</Text>
                <Text style={styles.small}>{f.audiencia ? 'SIM' : 'Não'}</Text>
              </View>
            </View>
            {f.ba && f.baRelacionada ? (
              <Text style={[styles.small, { marginTop: 6, color: C.danger, fontFamily: 'Helvetica-Bold' }]}>
                B.A. relacionada ao processo/dívida: SIM ({f.baTipo || 'tipo n/d'})
              </Text>
            ) : f.ba ? (
              <Text style={[styles.small, { marginTop: 6, color: C.danger }]}>
                Indício de Busca/Apreensão — validar vínculo com este CNJ antes de alarmar o cliente
              </Text>
            ) : (
              <Text style={[styles.small, { marginTop: 6 }]}>Busca e apreensão: não</Text>
            )}
            {f.penhora && f.penhoraRelacionada ? (
              <Text style={[styles.small, { marginTop: 3, color: C.danger }]}>Penhora de bens relacionada: SIM</Text>
            ) : null}
          </View>

          {/* Tribunal / DJEN */}
          <Text style={styles.h2}>Tribunal (DataJud) e Diário Oficial</Text>
          <View style={styles.box}>
            <View style={styles.grid}>
              <View style={styles.col}>
                <Line label="Último movimento" value={data.datajudNome} />
                <Line label="Data" value={data.datajudUltimo} />
              </View>
              <View style={styles.col}>
                <Line label="Resumo DJEN" value={data.djenResumo} />
              </View>
            </View>
            <Text style={[styles.tiny, { marginTop: 4 }]}>Movimentos recentes:</Text>
            {(data.movimentos || []).slice(0, 6).map((m, i) => (
              <Text key={i} style={styles.small}>
                • {m.data || '—'} — {m.nome || 'movimento'}
              </Text>
            ))}
            {(data.comunicacoes || []).slice(0, 4).map((c, i) => (
              <Text key={i} style={styles.small}>
                · DO: {c.data || '—'} — {(c.resumo || '').slice(0, 160)}
              </Text>
            ))}
            {data.djenLink ? (
              <Text style={[styles.tiny, { marginTop: 4, color: C.brand }]}>Link: {data.djenLink}</Text>
            ) : null}
          </View>

          {/* Análise assistida */}
          {data.analiseClaude ? (
            <>
              <Text style={styles.h2}>Análise assistida (IA)</Text>
              <View style={styles.box}>
                <Text style={styles.small}>{data.analiseClaude}</Text>
              </View>
            </>
          ) : null}

          {/* Narrativas */}
          <Text style={styles.h2}>Defesa da operação</Text>
          <View style={styles.boxOk}>
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

          {f.atendidoSemana ? (
            <View style={styles.boxOk}>
              <Text style={styles.sectionNote}>Atendimento nesta semana</Text>
              <Text style={styles.small}>
                Último retorno registrado dentro da semana operacional ({f.semanaLabel || 'semana atual'}).
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Documento interno · LexisPredict · Não substitui parecer jurídico formal · {data.protocolo}
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