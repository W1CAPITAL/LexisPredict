import { describe, expect, it } from 'vitest';
import { bpmnIntent, bpmnSkillContext } from '@/lib/bpmn-skill';
import { resolveSystemPrompt } from '@/lib/ai/prompts';

describe('BPMN skill integration', () => {
  it('detecta pedidos explícitos e implícitos de modelagem de processo', () => {
    expect(bpmnIntent('crie um BPMN para atendimento jurídico')).toBe(true);
    expect(bpmnIntent('modele um fluxo de prazo com swimlanes')).toBe(true);
    expect(bpmnIntent('explique este processo no Camunda')).toBe(true);
    expect(bpmnIntent('qual a taxa do BACEN?')).toBe(false);
  });

  it('injeta contrato de modelagem segura e tooling determinístico', () => {
    const ctx=bpmnSkillContext('faça um diagrama BPMN do fluxo DataJud e DJEN');
    expect(ctx).toContain('SKILL BPMN 2.0 ATIVA');
    expect(ctx).toContain('skills/bpmn/scripts/bpmn-tool.mjs');
    expect(ctx).toContain('DataJud/DJEN');
    expect(ctx).toContain('deadlock');
  });

  it('expõe BPMN no resolvedor de prompts', () => {
    expect(resolveSystemPrompt('bpmn')).toContain('BPMN 2.0');
  });
});
