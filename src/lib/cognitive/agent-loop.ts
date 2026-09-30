import type { CognitivePlan } from './types';

export type AgentRunState = 'planned' | 'running' | 'verifying' | 'done' | 'failed';

export type AgentRun = {
  id: string;
  state: AgentRunState;
  plan: CognitivePlan;
  startedAt: string;
  finishedAt?: string;
  evidence: string[];
  errors: string[];
};

export function createAgentRun(id: string, plan: CognitivePlan, now = new Date()): AgentRun {
  return {
    id,
    state: 'planned',
    plan,
    startedAt: now.toISOString(),
    evidence: [],
    errors: [],
  };
}

export function advanceAgentRun(
  run: AgentRun,
  event:
    | { type: 'start' }
    | { type: 'evidence'; value: string }
    | { type: 'verify' }
    | { type: 'success'; value?: string }
    | { type: 'failure'; error: string },
  now = new Date()
): AgentRun {
  const next: AgentRun = {
    ...run,
    evidence: [...run.evidence],
    errors: [...run.errors],
  };

  if (event.type === 'start' && run.state === 'planned') next.state = 'running';
  if (event.type === 'evidence') next.evidence.push(event.value);
  if (event.type === 'verify' && (run.state === 'running' || run.state === 'planned')) next.state = 'verifying';
  if (event.type === 'success') {
    if (event.value) next.evidence.push(event.value);
    next.state = 'done';
    next.finishedAt = now.toISOString();
  }
  if (event.type === 'failure') {
    next.errors.push(event.error);
    next.state = 'failed';
    next.finishedAt = now.toISOString();
  }

  return next;
}
