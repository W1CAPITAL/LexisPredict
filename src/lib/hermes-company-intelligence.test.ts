import { describe, expect, it } from 'vitest';
import {
  buildHermesOfficeIntelligence,
  makeHermesMeetingPrompt,
  sanitizeHermesMeetingOutput,
  describeHermesCaseHealth,
  type HermesOfficeMetrics,
} from '@/lib/hermes-company-intelligence';

const metrics: HermesOfficeMetrics = {
  total: 120, active: 87, overdue: 19, alerts: 7,
  staleSources: 13, readyReviews: 8, unavailableReviews: 3,
  criticalReviews: 2, draftMessages: 8, completedActivities30d: 31,
  contacts30d: 11, checkedSources30d: 9,
};

describe('Hermes company intelligence', () => {
  it('counts real work without inventing employee equivalence or judicial outcome probabilities', () => {
    const office = buildHermesOfficeIntelligence(metrics, '2026-11-10');
    expect(office.counters.completedActivities30d).toBe(31);
    expect(office.departments).toHaveLength(8);
    expect(office.departments.some(x => x.role === 'Gerência')).toBe(true);
    expect(office.departments.some(x => x.role.startsWith('Supervisor'))).toBe(true);
    expect(office.risks.some(x => x.id === 'overdue')).toBe(true);
    expect(JSON.stringify(office)).not.toMatch(/% de chance|equivale a.*pessoa|senten[cç]a garantida/i);
  });

  it('keeps uncertainty explicit when neither DJEN nor DataJud confirms coverage', () => {
    const office = buildHermesOfficeIntelligence({ ...metrics, readyReviews: 0, unavailableReviews: 8, checkedSources30d: 0 }, '2026-11-10');
    expect(office.health).toBe('Verificação insuficiente');
    expect(office.risks.some(x => x.id === 'sources')).toBe(true);
  });

  it('awards badges only against verifiable completed activity and does not execute arbitrary model cloning', () => {
    const office = buildHermesOfficeIntelligence({ ...metrics, completedActivities30d: 0, contacts30d: 0, draftMessages: 0, readyReviews: 0, checkedSources30d: 0 }, '2026-11-10');
    expect(office.award).toBeNull();
    expect(office.suggestedStrategy).toContain('revisão');
  });

  it('builds an anonymized bounded meeting prompt from metrics, not client names', () => {
    const prompt = makeHermesMeetingPrompt(metrics, '2026-11-10');
    expect(prompt.length).toBeLessThan(2000);
    expect(prompt).toContain('19');
    expect(prompt).toContain('fontes');
    expect(prompt).not.toContain('CPF');
    expect(sanitizeHermesMeetingOutput('OK\u0000'.repeat(500)).length).toBeLessThanOrEqual(1400);
  });
});

describe('Hermes individual case monitoring health', () => {
  it('does not invent win/loss predictions from a process priority score', () => {
    const row=describeHermesCaseHealth({
      processId:100,client:'Pessoa',cnj:'10000000020268000000',
      priorityScore:90,priorityLabel:'Crítica',
      djenOk:true,datajudOk:false,
      checkedAt:'2026-11-10T12:00:00Z',dueOn:'2026-11-10',
    });
    expect(row.level).toBe('Revisão urgente');
    expect(row.sourceStatus).toContain('DataJud');
    expect(row).not.toHaveProperty('winProbability');
    expect(row).not.toHaveProperty('lossProbability');
  });
  it('marks absent judicial verification rather than claiming the case is safe', () => {
    const row=describeHermesCaseHealth({
      processId:120,client:'Cliente',cnj:'20000000020268000000',
      priorityScore:0,priorityLabel:'Normal',djenOk:false,datajudOk:false,
      checkedAt:null,dueOn:null,
    });
    expect(row.level).toBe('Sem fonte confirmada');
  });
});
