/**
 * Dossiê individual do processo — defesa da operação + relação com o cliente.
 * Layout profissional LexisPredict: bandeira de marca, KPIs, sinais, tribunal, DJEN,
 * atendimento e narrativas com numeração de página real.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const C = {
  ink: '#0B1220',
  body: '#1e293b',
  muted: '#475569',
  faint: '#94a3b8',
  line: '#e2e8f0',
  soft: '#f8fafc',
  brand: '#0e7490',
  brandDark: '#164e63',
  brandSoft: '#ecfeff',
  danger: '#dc2626',
  dangerSoft: '#fef2f2',
  warn: '#d97706',
  warnSoft: '#fffbeb',
  ok: '#059669',
  okSoft: '#ecfdf5',
  white: '#ffffff',
} as const;

const s = StyleSheet.create({
  page: {
    paddingTop: 0,
    paddingBottom: 40,
    paddingHorizontal: 0,
    fontSize: 9,
    color: C.body,
    fontFamily: 'Helvetica',
    backgroundColor: C.white,
  },
  headerBand: {
    backgroundColor: C.brandDark,
    paddingTop: 16,
    paddingBottom: 14,
    paddingHorizontal: 30,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandName: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: C.white,
    letterSpacing: 1.4,
  },
  brandSub: { fontSize: 7, color: '#a5f3fc', marginTop: 2, letterSpacing: 0.5 },
  confBadge: {
    fontSize: 7,
    color: C.white,
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 3,
    letterSpacing: 0.5,
  },
  titleBlock: {
    paddingHorizontal: 30,
    paddingTop: 14,
    paddingBottom: 10,
    backgroundColor: C.soft,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  h1: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: C.ink, marginBottom: 3 },
  metaLine: { fontSize: 8, color: C.muted, letterSpacing: 0.2 },
  kpiRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  kpi: {
    flex: 1,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  kpiLabel: { fontSize: 6.5, color: C.faint, fontFamily: 'Helvetica-Bold', letterSpacing: 0.4, textTransform: 'uppercase' },
  kpiValue: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.ink, marginTop: 2 },
  content: { paddingHorizontal: 30, paddingTop: 12 },
  h2: {
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
    color: C.ink,
    marginTop: 10,
    marginBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    paddingBottom: 3,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  line: { width: '50%', flexDirection: 'row', marginBottom: 3, paddingRight: 8 },
  lineFull: { width: '100%', flexDirection: 'row', marginBottom: 3 },
  label: { width: '38%', color: C.muted, fontFamily: 'Helvetica-Bold', fontSize: 8 },
  value: { width: '62%', fontSize: 8 },
  box: {
    backgroundColor: C.soft,
    padding: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 4,
  },
  warnBox: { backgroundColor: C.warnSoft, borderColor: '#fcd34d', padding: 8, marginBottom: 6, borderRadius: 4 },
  okBox: { backgroundColor: C.okSoft, borderColor: '#a7f3d0', padding: 8, marginBottom: 6, borderRadius: 4 },
  dangerBox: { backgroundColor: C.dangerSoft, borderColor: '#fecaca', padding: 8, marginBottom: 6, borderRadius: 4 },
  small: { fontSize: 7.5, color: C.body, lineHeight: 1.5 },
  smallBold: { fontSize: 7.5, color: C.ink, fontFamily: 'Helvetica-Bold' },
  tagRow: { flexDirection: 'row', gap: 4, marginBottom: 4, flexWrap: 'wrap' },
  tag: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: C.brandDark,
    backgroundColor: C.brandSoft,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 3,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  tagDanger: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: C.danger, backgroundColor: C.dangerSoft, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 3, letterSpacing: 0.4, textTransform: 'uppercase' },
  tagOk: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: C.ok, backgroundColor: C.okSoft, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 3, letterSpacing: 0.4, textTransform: 'uppercase' },
  footer: {
    position: 'absolute',
    bottom: 22,
    left: 30,
    right: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingTop: 6,
  },
  footerText: { fontSize: 6.5, color: C.faint, letterSpacing: 0.3 },
});

function Line({ label, value, half = false }: { label: string; value?: string | null; half?: boolean }) {
  if (!value) return null;
  return (
    <View style={half ? s.line : s.lineFull}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.value}>{value}</Text>
    </View>
  );
}

export function DossieProcessoPDF({ data }: { data: DossieProcessoData }) {
  const f = data.flags || {};
  const sinais: { text: string; kind: 'normal' | 'danger' | 'ok' }[] = [
    { text: f.novidade ? 'Novidade' : '', kind: 'danger' },
    { text: f.baixa ? 'Baixa tribunal' : '', kind: 'ok' },
    { text: f.ba ? 'Busca e apreensão' : '', kind: 'danger' },
    { text: f.penhora ? 'Penhora' : '', kind: 'danger' },
    { text: f.cumprimento ? 'Cumprimento' : '', kind: 'warn' },
    { text: f.custas ? 'Custas' : '', kind: 'warn' },
    { text: f.audiencia ? 'Audiência' : '', kind: 'warn' },
    { text: f.procedente ? 'Sentença procedente' : '', kind: 'ok' },
    { text: f.improcedente ? 'Sentença improcedente' : '', kind: 'danger' },
    { text: f.atendidoSemana ? 'Atendido na semana' : '', kind: 'ok' },
  ].filter((x) => x.text);

  const temRisco = f.ba || f.penhora || f.novidade || f.improcedente || (data.tempoRespostaDias ?? 0) > 15;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.headerBand}>
          <View style={s.headerRow}>
            <View>
              <Text style={s.brandName}>LEXISPREDICT</Text>
              <Text style={s.brandSub}>Dossiê Operacional do Processo</Text>
            </View>
            <Text style={s.confBadge}>INTERNO • {data.protocolo}</Text>
          </View>
        </View>

        <View style={s.titleBlock}>
          <Text style={s.h1}>{data.cliente}</Text>
          <Text style={s.metaLine}>
            Gerado em {data.geradoEm} • {data.tribunal || 'Tribunal não identificado'} • {data.advogado ? `Adv. ${data.advogado}` : ''}
          </Text>
          <View style={s.kpiRow}>
            <View style={s.kpi}>
              <Text style={s.kpiLabel}>Status</Text>
              <Text style={s.kpiValue}>{data.status || '—'}</Text>
            </View>
            <View style={s.kpi}>
              <Text style={s.kpiLabel}>Sem retorno</Text>
              <Text style={s.kpiValue}>{data.tempoRespostaDias != null ? `${data.tempoRespostaDias} dia(s)` : '—'}</Text>
            </View>
            <View style={s.kpi}>
              <Text style={s.kpiLabel}>Último retorno</Text>
              <Text style={s.kpiValue}>{data.ultimoRetorno || '—'}</Text>
            </View>
            <View style={s.kpi}>
              <Text style={s.kpiLabel}>Próximo prazo</Text>
              <Text style={s.kpiValue}>{data.proximoPrazo || '—'}</Text>
            </View>
          </View>
        </View>

        <View style={s.content}>
          <Text style={s.h2}>Sinais operacionais</Text>
          <View style={temRisco ? s.dangerBox : s.okBox}>
            <View style={s.tagRow}>
              {sinais.length ? (
                sinais.map((sg, i) => (
                  <Text key={i} style={sg.kind === 'danger' ? s.tagDanger : sg.kind === 'ok' ? s.tagOk : s.tag}>
                    {sg.text}
                  </Text>
                ))
              ) : (
                <Text style={s.tagOk}>Sem alertas ativos</Text>
              )}
            </View>
            {f.ba && !f.baRelacionada ? (
              <Text style={s.small}>Indício de B.A. — validar vínculo com este CNJ antes de alarmar o cliente.</Text>
            ) : f.ba && f.baRelacionada ? (
              <Text style={s.small}>B.A. relacionada ao processo/dívida: SIM ({f.baTipo || 'tipo n/d'}).</Text>
            ) : null}
            {f.penhora && f.penhoraRelacionada ? <Text style={s.small}>Penhora de bens relacionada: SIM.</Text> : null}
            {f.improcedente ? <Text style={s.small}>Mérito: sentença improcedente registrada.</Text> : null}
          </View>

          <Text style={s.h2}>Identificação</Text>
          <View style={s.box}>
            <View style={s.grid}>
              <Line half label="Cliente" value={data.cliente} />
              <Line half label="CNJ" value={data.protocolo} />
              <Line half label="Tribunal" value={data.tribunal} />
              <Line half label="Advogado" value={data.advogado} />
              <Line half label="Escritório" value={data.escritorio} />
              <Line half label="Telefone" value={data.telefone} />
              <Line half label="Status interno" value={data.status} />
              <Line half label="Último retorno" value={data.ultimoRetorno} />
              <Line half label="Próximo prazo" value={data.proximoPrazo} />
            </View>
          </View>

          <Text style={s.h2}>Tribunal (DataJud)</Text>
          <View style={s.box}>
            <Line label="Último movimento" value={data.datajudNome} />
            <Line label="Data" value={data.datajudUltimo} />
            {(data.movimentos || []).slice(0, 8).map((m, i) => (
              <Text key={i} style={s.small}>
                · {m.data || '—'} — {m.nome || 'movimento'}
              </Text>
            ))}
          </View>

          <Text style={s.h2}>Diário Oficial (DJEN)</Text>
          <View style={s.box}>
            <Line label="Resumo" value={data.djenResumo} />
            <Line label="Link" value={data.djenLink} />
            {(data.comunicacoes || []).slice(0, 5).map((c, i) => (
              <Text key={i} style={s.small}>
                · {c.data || '—'} — {(c.resumo || '').slice(0, 160)}
              </Text>
            ))}
          </View>

          {data.flags?.atendidoSemana ? (
            <View style={s.okBox}>
              <Text style={s.smallBold}>Atendimento nesta semana</Text>
              <Text style={s.small}>Último retorno registrado dentro da semana operacional ({data.flags.semanaLabel || 'semana atual'}).</Text>
            </View>
          ) : null}

          {data.analiseClaude ? (
            <>
              <Text style={s.h2}>Análise assistida (IA)</Text>
              <View style={s.box}>
                <Text style={s.small}>{data.analiseClaude}</Text>
              </View>
            </>
          ) : null}

          <Text style={s.h2}>Narrativa operacional (defesa da empresa)</Text>
          <View style={s.okBox}>
            <Text style={s.small}>
              {data.narrativaOperacional ||
                'Equipe monitora tribunal e diário; retornos registrados; pendências priorizadas na fila.'}
            </Text>
          </View>

          <Text style={s.h2}>Relação com o cliente</Text>
          <View style={s.box}>
            <Text style={s.small}>
              {data.narrativaCliente ||
                'Comunicação objetiva, sem juridiquês; validação humana antes de qualquer orientação definitiva.'}
            </Text>
            {data.observacao ? (
              <Text style={{ ...s.small, marginTop: 6 }}>
                Observações do gabinete: {data.observacao}
              </Text>
            ) : null}
          </View>

          <View style={s.footer} fixed>
            <Text style={s.footerText}>Documento interno • LexisPredict • Não substitui parecer jurídico formal</Text>
            <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
          </View>
        </View>
      </Page>
    </Document>
  );
}

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
