import React from 'react';
import { Document, Page, Text, View, Link, Font, StyleSheet, Svg, Defs, LinearGradient, Stop, Rect, Circle } from '@react-pdf/renderer';
import {
  REPORT_COLORS as C, REPORT_PALETTE, planReportPages, reportDate, reportValue, reportPersonColor,
  type VisualReport, type ReportMetric, type ReportPage, type ReportSection,
} from '@/lib/report/visual-report';

// Local fonts: the server never needs an external font service to export a report.
const fontBase = typeof window === 'undefined' ? process.cwd() + '/public/fonts/report/' : window.location.origin + '/fonts/report/';
Font.register({ family: 'ReportSans', fonts: [
  { src: fontBase + 'Ubuntu-R.ttf', fontWeight: 400 }, { src: fontBase + 'Ubuntu-B.ttf', fontWeight: 700 },
] });
Font.registerHyphenationCallback(word => word.length > 45 ? word.match(/.{1,35}/g) || [word] : [word]);

const s = StyleSheet.create({
  page: { fontFamily: 'ReportSans', backgroundColor: C.paper, color: C.ink, fontSize: 9, padding: 0, height: 595.28, minHeight: 595.28 },
  rail: { position: 'absolute', top: 16, bottom: 16, left: 16, width: 42, borderRadius: 18, backgroundColor: '#FFF', alignItems: 'center', paddingTop: 12 },
  logo: { width: 28, height: 28, borderRadius: 10, backgroundColor: C.blue, justifyContent: 'center', alignItems: 'center', marginBottom: 19 },
  logoText: { color: '#FFF', fontWeight: 700, fontSize: 9 },
  nav: { width: 27, height: 27, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  navText: { fontSize: 8, color: '#8A99AF', textDecoration: 'none' },
  brand: { position: 'absolute', top: 22, left: 78, width: 510 },
  company: { fontWeight: 700, fontSize: 11 },
  brandSub: { fontSize: 7, color: C.muted, marginTop: 4 },
  stamp: { position: 'absolute', top: 24, right: 23, fontSize: 8, color: C.muted, backgroundColor: '#FFF', borderRadius: 9, paddingVertical: 7, paddingHorizontal: 11 },
  heading: { position: 'absolute', top: 77, left: 78, right: 23 },
  eyebrow: { color: C.blue, fontSize: 7.7, fontWeight: 700, marginBottom: 9 },
  title: { fontSize: 23, fontWeight: 700, lineHeight: 1.15, maxWidth: 730 },
  subtitle: { fontSize: 8.6, color: C.muted, lineHeight: 1.35, marginTop: 9 },
  body: { position: 'absolute', top: 166, left: 78, right: 23 },
  hero: { position: 'absolute', top: 77, left: 78, width: 741, height: 211, borderRadius: 20, overflow: 'hidden', padding: 24 },
  heroMark: { fontSize: 8, color: '#C8DAFF', letterSpacing: .6, marginBottom: 16 },
  heroTitle: { fontSize: 32, lineHeight: 1.1, fontWeight: 700, color: '#FFF', maxWidth: 560 },
  heroSub: { color: '#C8D8F4', fontSize: 11, marginTop: 12, maxWidth: 570, lineHeight: 1.4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 17, gap: 8 },
  heroChip: { backgroundColor: '#3F4773', color: '#E2E9FF', fontSize: 7.5, borderRadius: 9, paddingVertical: 6, paddingHorizontal: 9, maxWidth: 430 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 11 },
  metric: { width: 239, minHeight: 86, backgroundColor: '#FFF', borderRadius: 14, padding: 14, borderBottomWidth: 2, borderBottomColor: '#E6EBF5' },
  metricValue: { fontSize: 28, fontWeight: 700, color: C.blue, marginBottom: 7 },
  metricLabel: { color: C.ink, fontSize: 8.7, fontWeight: 700 },
  metricNote: { color: C.muted, fontSize: 7.3, marginTop: 4, lineHeight: 1.2 },
  panel: { backgroundColor: '#FFF', borderRadius: 16, padding: 18, borderBottomWidth: 2, borderBottomColor: '#E6EBF5' },
  panelTitle: { fontSize: 13, fontWeight: 700, marginBottom: 14 },
  callout: { backgroundColor: '#E8EEF9', borderRadius: 10, padding: 12 },
  calloutText: { fontSize: 8.2, color: C.muted, lineHeight: 1.4 },
  barRow: { flexDirection: 'row', alignItems: 'center', minHeight: 23, marginBottom: 2 },
  barLabel: { width: 230, fontSize: 9, paddingRight: 10, color: C.ink },
  track: { height: 9, backgroundColor: C.line, borderRadius: 5, flexGrow: 1, overflow: 'hidden' },
  barValue: { width: 75, textAlign: 'right', fontSize: 10, fontWeight: 700 },
  note: { fontSize: 8, color: C.muted, lineHeight: 1.4, marginTop: 13 },
  people: { flexDirection: 'row', flexWrap: 'wrap', gap: 11 },
  person: { width: 239, height: 176, backgroundColor: '#FFF', padding: 14, borderRadius: 15, borderBottomWidth: 2, borderBottomColor: '#E6EBF5' },
  personTop: { flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 30 },
  avatar: { width: 29, height: 29, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  personName: { fontSize: 12, fontWeight: 700, flex: 1, maxLines: 2 },
  personRole: { fontSize: 7.6, color: C.muted, marginTop: 7, maxLines: 2, lineHeight: 1.2 },
  personMetrics: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 11, gap: 8 },
  personMetric: { width: '47%' },
  personNumber: { fontSize: 17, fontWeight: 700 },
  personLabel: { fontSize: 7, color: C.muted, marginTop: 3 },
  personNote: { fontSize: 6.9, color: C.muted, marginTop: 5, lineHeight: 1.2, maxLines: 2 },
  table: { backgroundColor: '#FFF', borderRadius: 14, padding: 11 },
  tableHead: { flexDirection: 'row', backgroundColor: '#EAF0FC', borderRadius: 6, paddingVertical: 9 },
  tableHeadCell: { fontSize: 7.3, fontWeight: 700, color: C.muted, paddingHorizontal: 8 },
  tableRow: { flexDirection: 'row', paddingVertical: 7, borderBottomWidth: .5, borderBottomColor: '#EDF1F8', minHeight: 24 },
  tableCell: { fontSize: 8.1, color: C.ink, paddingHorizontal: 8, lineHeight: 1.2 },
  record: { backgroundColor: '#FFF', borderRadius: 12, padding: 12, marginBottom: 9 },
  recordMeta: { fontSize: 7.5, color: C.purple, marginBottom: 6 },
  recordTitle: { fontSize: 10.7, fontWeight: 700, lineHeight: 1.25 },
  recordBody: { fontSize: 8.4, color: C.muted, lineHeight: 1.4, marginTop: 7 },
  recordSource: { fontSize: 7.4, color: C.blue, marginTop: 6, lineHeight: 1.3 },
  noteCard: { backgroundColor: '#FFF', borderRadius: 13, padding: 16, marginBottom: 11, flexDirection: 'row', gap: 14 },
  noteIndex: { fontSize: 16, color: C.purple, fontWeight: 700, width: 24 },
  noteText: { flex: 1, color: C.muted, fontSize: 10, lineHeight: 1.5 },
  footer: { position: 'absolute', bottom: 16, left: 78, right: 23, borderTopWidth: .6, borderTopColor: C.line, paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 6.8, color: C.muted },
});

function safeText(value: string | undefined, length: number) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > length ? text.slice(0, length).trim() + '… (continua no sistema)' : text;
}
function Metrics({ metrics }: { metrics: ReportMetric[] }) {
  return <View style={s.metrics}>{metrics.map((m, i) => <View style={s.metric} key={m.label + i}>
    <Text style={[s.metricValue, { color: m.color || REPORT_PALETTE[i % REPORT_PALETTE.length], fontSize: reportValue(m.value).length > 13 ? 19 : 28 }]}>{reportValue(m.value)}</Text>
    <Text style={s.metricLabel}>{m.label}</Text>{m.note ? <Text style={s.metricNote}>{m.note}</Text> : null}
  </View>)}</View>;
}
function Backdrop() {
  return <Svg width={842} height={595} style={{ position: 'absolute', left: 0, top: 0 }} viewBox="0 0 842 595">
    <Defs><LinearGradient id="report-bg" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#F7F8FD"/><Stop offset="1" stopColor="#EAF2F9"/></LinearGradient></Defs>
    <Rect x="0" y="0" width="842" height="595" fill="url(#report-bg)"/>
    <Circle cx="766" cy="60" r="145" fill="#E6E7FC" opacity=".4"/><Circle cx="540" cy="520" r="155" fill="#DBF1ED" opacity=".35"/>
  </Svg>;
}
function Hero() {
  return <Svg width="741" height="211" viewBox="0 0 741 211" style={{ position: 'absolute', left: 0, top: 0 }}>
    <Defs><LinearGradient id="report-hero" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#18264D"/><Stop offset="1" stopColor="#35255E"/></LinearGradient></Defs>
    <Rect x="0" y="0" width="741" height="211" rx="20" fill="url(#report-hero)"/>
    {[55, 86, 117, 148].map(r => <Circle key={r} cx="680" cy="106" r={r} fill="none" stroke="#8895F0" opacity=".12" strokeWidth=".8"/>)}
    <Rect x="590" y="28" width="120" height="155" rx="20" fill="#FFFFFF" opacity=".04" stroke="#A7BCFF" strokeWidth="1"/>
  </Svg>;
}
function Body({ section }: { section: ReportSection }) {
  if (section.kind === 'metrics') return <Metrics metrics={section.metrics}/>;
  if (section.kind === 'charts') return <>{section.series.map((series, k) => {
    const max = Math.max(1, ...series.values.map(x => x.value || 0));
    return <View style={s.panel} key={series.label + k}><Text style={s.panelTitle}>{series.label}</Text>
      {series.values.map((x, i) => <View style={s.barRow} key={x.label + i}>
        <Text style={s.barLabel}>{x.label}</Text><View style={s.track}><View style={{ height: 9, width: `${Math.max(0, (x.value || 0) / max * 100)}%`, borderRadius: 5, backgroundColor: series.color || REPORT_PALETTE[i % REPORT_PALETTE.length] }}/></View>
        <Text style={[s.barValue, { color: series.color || REPORT_PALETTE[i % REPORT_PALETTE.length] }]}>{reportValue(x.value)}</Text>
      </View>)}{series.note ? <Text style={s.note}>{series.note}</Text> : null}
    </View>;
  })}</>;
  if (section.kind === 'people') return <View style={s.people}>{section.people.map((p, i) => {
    const color = reportPersonColor(p.id);
    return <View key={p.id + i} style={s.person}>
      <View style={s.personTop}><View style={[s.avatar, { backgroundColor: color + '18' }]}><Text style={{ color, fontSize: 16 }}>{p.name.slice(0, 1)}</Text></View><Text style={s.personName}>{p.name}</Text></View>
      {p.role ? <Text style={s.personRole}>{p.role}</Text> : null}
      <View style={s.personMetrics}>{p.metrics.slice(0, 4).map((m, j) => <View style={s.personMetric} key={m.label + j}><Text style={[s.personNumber, { color }]}>{reportValue(m.value)}</Text><Text style={s.personLabel}>{m.label}</Text></View>)}</View>
      {p.note ? <Text style={s.personNote}>{p.note}</Text> : null}
    </View>;
  })}</View>;
  if (section.kind === 'table') {
    const firstWidth = section.columns.length > 3 ? 27 : 32;
    const width = (i: number) => `${i === 0 ? firstWidth : (100 - firstWidth) / (section.columns.length - 1)}%`;
    return <View style={s.table}>
      <View style={s.tableHead}>{section.columns.map((x, i) => <Text key={x + i} style={[s.tableHeadCell, { width: width(i), textAlign: i === 0 ? 'left' : 'right' }]}>{x}</Text>)}</View>
      {section.rows.map((row, i) => <View key={i} style={[s.tableRow, { backgroundColor: i % 2 ? '#F5F7FC' : '#FFF' }]}>{row.map((x, j) => <Text key={j} style={[s.tableCell, { width: width(j), textAlign: j === 0 ? 'left' : 'right' }]}>{reportValue(x)}</Text>)}</View>)}
    </View>;
  }
  if (section.kind === 'records') return <>{section.records.map((r, i) => <View key={i} style={s.record}>
    {r.meta ? <Text style={s.recordMeta}>{r.meta}</Text> : null}<Text style={s.recordTitle}>{safeText(r.title, 220)}</Text>
    {r.body ? <Text style={s.recordBody}>{safeText(r.body, 1000)}</Text> : null}
    {r.reference ? <Text style={s.recordSource}>Referência: {r.reference}</Text> : null}
    {r.source ? <Text style={s.recordSource}>Fonte: {safeText(r.source, 250)}</Text> : null}
  </View>)}</>;
  return <>{section.items.map((item, i) => <View key={i} style={s.noteCard}><Text style={s.noteIndex}>{String(i + 1).padStart(2, '0')}</Text><Text style={s.noteText}>{item}</Text></View>)}</>;
}

export function VisualReportPdf({ report }: { report: VisualReport }) {
  const pages = planReportPages(report);
  return <Document title={report.title + ' - ' + report.company} author={report.company} subject={report.scope + ' / ' + report.period} creator="LexisPredict">
    {pages.map((page: ReportPage, index) => {
      const navIndexes = [...new Set([0, ...Array.from({ length: Math.min(9, pages.length - 1) }, (_, i) => i + 1), index, pages.length - 1])].sort((a, b) => a - b);
      return <Page key={page.id} id={page.id} bookmark={page.title} size="A4" orientation="landscape" style={s.page} wrap={false}>
        <Backdrop/>
        <View style={s.rail}><View style={s.logo}><Text style={s.logoText}>LP</Text></View>{navIndexes.map(i => <View key={i} style={[s.nav, { backgroundColor: i === index ? C.blue : '#FFF' }]}><Link src={'#' + pages[i].id} style={[s.navText, { color: i === index ? '#FFF' : '#8A99AF' }]}>{String(i + 1).padStart(2, '0')}</Link></View>)}</View>
        <View style={s.brand}><Text style={s.company}>{report.company}</Text><Text style={s.brandSub}>LEXISPREDICT / GESTÃO E RESULTADOS</Text></View>
        <Text style={s.stamp}>Consulta: {reportDate(report.generatedAt)}</Text>
        {page.cover ? <>
          <View style={s.hero}><Hero/><Text style={s.heroMark}>O PERÍODO EM UMA LEITURA</Text><Text style={[s.heroTitle, { fontSize: report.title.length > 35 ? 27 : 32 }]}>{report.title}</Text><Text style={s.heroSub}>{report.subtitle}</Text>
            <View style={s.chipRow}><Text style={s.heroChip}>{report.scope}</Text><Text style={s.heroChip}>{report.period}</Text></View>
          </View>
          <View style={{ position: 'absolute', left: 78, top: 307, right: 23 }}><Metrics metrics={report.metrics.slice(0, 6)}/></View>
          <View style={[s.callout, { position: 'absolute', left: 78, right: 23, top: 511 }]}><Text style={s.calloutText}>{report.limitations[0] || 'Dados da consulta autorizada. Cada indicador preserva o critério de sua fonte.'}</Text></View>
        </> : <>
          <View style={s.heading}><Text style={s.eyebrow}>{safeText(report.scope.toLocaleUpperCase('pt-BR'), 95)}{page.parts && page.parts > 1 ? ` / PARTE ${page.part} DE ${page.parts}` : ''}</Text><Text style={[s.title, { fontSize: page.title.length > 95 ? 16 : page.title.length > 65 ? 18 : 23 }]}>{page.title}</Text>{page.section?.subtitle ? <Text style={s.subtitle}>{page.section.subtitle}</Text> : null}</View>
          <View style={s.body}>{page.section ? <Body section={page.section}/> : null}{page.section?.note ? <Text style={s.note}>{page.section.note}</Text> : null}</View>
        </>}
        <View style={s.footer}><Text style={s.footerText}>EQUIPE / OPERAÇÃO / RESULTADOS  •  USO INTERNO</Text><Text style={s.footerText}>{index + 1} / {pages.length}</Text></View>
      </Page>;
    })}
  </Document>;
}
