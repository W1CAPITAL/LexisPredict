import { describe, expect, it } from 'vitest';
import { assessEvidence } from './evidence';
import { createSnapshot, diffSnapshots } from './change-watch';
import { advanceAgentRun, createAgentRun } from './agent-loop';
import { buildCognitivePlan } from './orchestrator';

describe('cognitive platform primitives', () => {
  it('detects meaningful snapshot changes', () => {
    const before = createSnapshot('status: aguardando\nvalor: 10');
    const after = createSnapshot('status: publicado\nvalor: 10');
    const diff = diffSnapshots(before, after);
    expect(diff.changed).toBe(true);
    expect(diff.added).toContain('status: publicado');
    expect(diff.removed).toContain('status: aguardando');
  });

  it('detects conflicting evidence', () => {
    const result = assessEvidence([
      { id: '1', claim: 'houve publicação', source: 'DJEN', kind: 'supports', reliability: 0.95 },
      { id: '2', claim: 'não houve publicação', source: 'nota antiga', kind: 'contradicts', reliability: 0.4 },
    ]);
    expect(result.hasConflict).toBe(true);
    expect(result.balance).toBeGreaterThan(0);
  });

  it('requires an explicit verification stage in agent runs', () => {
    const run = createAgentRun('r1', buildCognitivePlan({ text: 'automatize retorno de processo' }));
    const started = advanceAgentRun(run, { type: 'start' });
    const verifying = advanceAgentRun(started, { type: 'verify' });
    const done = advanceAgentRun(verifying, { type: 'success', value: 'teste passou' });
    expect(done.state).toBe('done');
    expect(done.evidence).toContain('teste passou');
  });
});
