/** Shared, serializable report contract. Every value comes from the authorized query. */
export const REPORT_COLORS = {
  ink: '#151D35', muted: '#66738B', blue: '#306DEB', purple: '#745DE8',
  teal: '#099F9B', gold: '#BD8B48', red: '#C76A73', paper: '#F2F5FB', line: '#E5EAF4',
} as const;
export const REPORT_PALETTE = [REPORT_COLORS.blue, REPORT_COLORS.purple, REPORT_COLORS.teal, REPORT_COLORS.gold, REPORT_COLORS.red];
export type ReportValue = number | string | null;
export type ReportMetric = { label: string; value: ReportValue; note?: string; color?: string };
export type ReportRecord = { title: string; body?: string; meta?: string; reference?: string; source?: string };
export type ReportPerson = { id: string; name: string; role?: string; metrics: ReportMetric[]; note?: string };
export type ReportSeries = { label: string; values: Array<{ label: string; value: number | null }>; note?: string; color?: string };
type SectionBase = { id: string; title: string; subtitle?: string; note?: string };
export type ReportSection = SectionBase & (
  | { kind: 'metrics'; metrics: ReportMetric[] }
  | { kind: 'charts'; series: ReportSeries[] }
  | { kind: 'people'; people: ReportPerson[] }
  | { kind: 'table'; columns: string[]; rows: ReportValue[][] }
  | { kind: 'records'; records: ReportRecord[] }
  | { kind: 'notes'; items: string[] }
);
export type VisualReport = {
  title: string; subtitle: string; company: string; scope: string; period: string;
  generatedAt: string; metrics: ReportMetric[]; sections: ReportSection[]; limitations: string[];
};
export type ReportPage = { id: string; title: string; cover?: boolean; section?: ReportSection; part?: number; parts?: number };

export function reportNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}
export function reportValue(value: ReportValue | undefined): string {
  return value == null || typeof value === 'number' && !Number.isFinite(value)
    ? '—' : typeof value === 'number' ? value.toLocaleString('pt-BR') : value;
}
export function reportDate(value?: string | null): string {
  if (!value) return 'Data não informada';
  if (value.includes('T')) {
    const timestamp = new Date(value);
    if (Number.isFinite(timestamp.getTime())) return timestamp.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(8, 10) + '/' + value.slice(5, 7) + '/' + value.slice(0, 4);
  return value;
}
/** Stable per identity, independent of ranking, filters or team size. */
export function reportPersonColor(id: string): string {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return REPORT_PALETTE[hash % REPORT_PALETTE.length];
}
export function reportCategory(value?: string | null): string {
  const labels: Record<string, string> = {
    atendimento: 'Atendimento', analise_processual: 'Análise processual', auditoria_documental: 'Revisão documental',
    auditoria_sistemica: 'Auditoria em lote', triagem_replica_provas: 'Réplica e provas', dossie_individual: 'Dossiê individual',
    investigacao_get: 'Investigação interna', investigacao_externa: 'Investigação externa', entrega_projeto: 'Projeto ou sistema',
    historico_atendimento_id_davi: 'Histórico de atendimentos', atendimento_por_perfil_davi: 'Histórico de atendimentos',
    historico_edicao_id_davi: 'Histórico de edições', edicao_por_nome_davi: 'Histórico de edições',
    historico_encerramento_lote_id_davi: 'Encerramentos importados', auditoria_por_perfil_davi: 'Auditoria por perfil',
  };
  return labels[value || ''] || String(value || 'Outra atividade').replaceAll('_', ' ');
}
export function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < values.length; i += size) result.push(values.slice(i, i + size));
  return result;
}
function byBudget<T>(items: T[], cost: (item: T) => number, budget: number): T[][] {
  const pages: T[][] = []; let page: T[] = [], used = 0;
  for (const item of items) {
    const next = cost(item);
    if (page.length && used + next > budget) { pages.push(page); page = []; used = 0; }
    page.push(item); used += next;
  }
  if (page.length) pages.push(page);
  return pages;
}

/** Pagination adapts to team size, long descriptions and available sections; never a fixed month or person. */
export function planReportPages(report: VisualReport): ReportPage[] {
  const pages: ReportPage[] = [{ id: 'overview', title: 'Visão geral', cover: true }];
  const sections: ReportSection[] = report.metrics.length > 6
    ? [{ id: 'more-metrics', kind: 'metrics', title: 'Outros indicadores', metrics: report.metrics.slice(6) }, ...report.sections]
    : report.sections;
  for (const section of sections) {
    let parts: ReportSection[] = [];
    switch (section.kind) {
      case 'metrics': parts = chunks(section.metrics, 9).map(metrics => ({ ...section, metrics })); break;
      case 'people': parts = chunks(section.people, 6).map(people => ({ ...section, people })); break;
      case 'charts':
        parts = section.series.flatMap(series => chunks(series.values, 12).map(values => ({ ...section, series: [{ ...series, values }] })));
        break;
      case 'table':
        parts = byBudget(section.rows, row => Math.max(1, ...row.map((value, index) =>
          Math.ceil(reportValue(value).length / (index === 0 ? 35 : Math.max(10, 100 / section.columns.length))))) + .5, 23)
          .map(rows => ({ ...section, rows }));
        break;
      case 'records':
        parts = byBudget(section.records, record => 4 + Math.ceil((record.body?.length || 0) / 110)
          + Math.ceil(record.title.length / 85) + Math.ceil((record.source?.length || 0) / 120), 28)
          .map(records => ({ ...section, records }));
        break;
      case 'notes': parts = chunks(section.items, 5).map(items => ({ ...section, items })); break;
    }
    // Preserve the difference between an empty selection and a missing source.
    if (!parts.length) parts = [{ ...section, kind: 'notes', items: ['Nenhum registro disponível nesta seleção. Ausência de lançamento não comprova ausência de trabalho.'] }];
    parts.forEach((part, index) => pages.push({ id: section.id + '-' + index, title: section.title, section: part, part: index + 1, parts: parts.length }));
  }
  return pages;
}

export function reportPriorities(values: { overdue: number | null; news: number | null; missing: number | null }): string[] {
  return [
    values.overdue == null ? 'A fila de vencidos está indisponível nesta consulta.' : values.overdue > 0
      ? `Revisar ${reportValue(values.overdue)} registros marcados como vencidos na carteira.` : 'Nenhum vencido marcado no recorte consultado. Novas demandas podem chegar ao longo do dia.',
    values.news == null ? 'A fonte de novidades não retornou um indicador válido.' : values.news > 0
      ? `Conferir ${reportValue(values.news)} processos com novidade antes de programar o retorno.` : 'Nenhuma novidade sinalizada nesta consulta.',
    values.missing == null ? 'O indicador de retorno não está disponível.' : values.missing > 0
      ? `Conferir ${reportValue(values.missing)} registros sem retorno segundo o critério da fonte.` : 'O critério consultado não identificou pendências de retorno.',
  ];
}
