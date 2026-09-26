import { describe, expect, it } from 'vitest';
import { applyWorkflowBindings } from './comfyui';

describe('ComfyUI workflow bindings', () => {
  it('replaces exact numeric and embedded text placeholders', () => {
    const workflow = {
      node1: { inputs: { width: '{{WIDTH}}', text: 'Prompt: {{PROMPT}}' } },
      node2: { inputs: { seed: '{{SEED}}' } },
    };
    const bound = applyWorkflowBindings(workflow, {
      WIDTH: 1024,
      PROMPT: 'painel jurídico',
      SEED: 42,
    });
    expect((bound as any).node1.inputs.width).toBe(1024);
    expect((bound as any).node1.inputs.text).toBe('Prompt: painel jurídico');
    expect((bound as any).node2.inputs.seed).toBe(42);
  });
});
