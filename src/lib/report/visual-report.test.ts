import { describe, expect, it } from 'vitest';
import { planReportPages, reportDate, reportNumber, reportPersonColor, reportPriorities, reportValue, type VisualReport } from './visual-report';

const base: VisualReport = { title: 'Relatório', subtitle: 'Operação', company: 'Empresa Aurora', scope: 'Equipe', period: 'Período escolhido', generatedAt: '2026-10-31', metrics: [], sections: [], limitations: [] };

describe('relatórios visuais adaptáveis', () => {
  it('mantém indisponibilidade diferente de zero e rejeita números inválidos', () => {
    expect(reportNumber(0)).toBe(0);
    expect(reportNumber(undefined)).toBeNull();
    expect(reportNumber(NaN)).toBeNull();
    expect(reportNumber(-1)).toBeNull();
    expect(reportValue(null)).toBe('—');
    expect(reportValue(0)).toBe('0');
    expect(reportDate('2026-11-01T01:00:00.000Z')).toBe('31/10/2026');
    expect(reportDate('2026-11-01')).toBe('01/11/2026');
  });
  it('distribui qualquer quantidade de pessoas, sem perder as últimas', () => {
    for (const size of [0, 1, 3, 7, 31]) {
      const people = Array.from({ length: size }, (_, i) => ({ id: String(i), name: 'Pessoa ' + i, metrics: [] }));
      const pages = planReportPages({ ...base, sections: [{ id: 'equipe', title: 'Equipe', kind: 'people', people }] });
      const included = pages.flatMap(p => p.section?.kind === 'people' ? p.section.people : []);
      expect(included).toEqual(people);
      expect(pages.every(p => p.section?.kind !== 'people' || p.section.people.length <= 6)).toBe(true);
    }
  });
  it('mantém todos os registros e linhas ao dividir conteúdo longo', () => {
    const records = Array.from({ length: 42 }, (_, i) => ({ title: 'Evidência ' + i, body: 'Texto documental. '.repeat(i % 7 * 10 + 1) }));
    const rows = Array.from({ length: 48 }, (_, i) => ['Nome longo '.repeat(i % 4 + 1), i, null]);
    const pages = planReportPages({ ...base, sections: [{ id: 'r', title: 'Registros', kind: 'records', records }, { id: 't', title: 'Tabela', kind: 'table', columns: ['Pessoa', 'Registros', 'Sem fonte'], rows }] });
    expect(pages.flatMap(p => p.section?.kind === 'records' ? p.section.records : [])).toEqual(records);
    expect(pages.flatMap(p => p.section?.kind === 'table' ? p.section.rows : [])).toEqual(rows);
    expect(new Set(pages.map(p => p.id)).size).toBe(pages.length);
  });
  it('não herda texto ou empresa de uma geração anterior', () => {
    const first = { ...base, company: 'Empresa Aurora' };
    const second = { ...base, company: 'Empresa Horizonte' };
    planReportPages(first);
    expect(second.company).toBe('Empresa Horizonte');
    expect(JSON.stringify(second)).not.toContain('Aurora');
    expect(JSON.stringify(base)).not.toMatch(/Davi|Adriana|Kris|GET|W1/);
  });
  it('mantém a cor da pessoa estável em filtros e ordenações', () => {
    const before = reportPersonColor('pessoa-um');
    reportPersonColor('pessoa-dois');
    expect(reportPersonColor('pessoa-um')).toBe(before);
  });
  it('redige prioridades a partir da fonte, sem afirmar WhatsApp zerado', () => {
    const absent = reportPriorities({ overdue: null, news: null, missing: null }).join(' ');
    const zero = reportPriorities({ overdue: 0, news: 0, missing: 0 }).join(' ');
    expect(absent).toContain('indisponível');
    expect(zero).toContain('Novas demandas');
    expect(absent + zero).not.toContain('WhatsApp zerado');
    expect(reportPriorities({ overdue: 17, news: 5, missing: 3 }).join(' ')).toContain('17');
  });
});
