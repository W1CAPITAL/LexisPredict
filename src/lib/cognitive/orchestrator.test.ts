import { describe, expect, it } from 'vitest';
import { buildCognitivePlan, inferCognitiveIntent } from './orchestrator';
import { retrieveMemory } from './memory';
import { runQualityGate } from './quality';

describe('cognitive orchestrator', () => {
  it('routes CNJ/DataJud to case analysis', () => {
    expect(inferCognitiveIntent('Atualize este processo pelo DataJud e DJEN')).toBe('case-analysis');
    const plan = buildCognitivePlan({ text: 'Analise o CNJ 123 e o DJEN' });
    expect(plan.steps[0].capability).toBe('lexis-rules');
    expect(plan.zeroTokenFirst).toBe(true);
  });

  it('routes web, simulation and media intents', () => {
    expect(inferCognitiveIntent('pesquisa web com Firecrawl sobre esta empresa')).toBe('web-research');
    expect(inferCognitiveIntent('simular três cenários com Monte Carlo')).toBe('simulation');
    expect(inferCognitiveIntent('gerar imagem por prompt')).toBe('image-generation');
    expect(inferCognitiveIntent('criar vídeo text-to-video')).toBe('video-generation');
    expect(buildCognitivePlan({ text: 'simular cenários' }).steps[0].capability).toBe('simulation-engine');
    expect(inferCognitiveIntent('crie um mundo procedural com chunks')).toBe('world-simulation');
    expect(inferCognitiveIntent('abra o plugin hub')).toBe('plugin-management');
    expect(inferCognitiveIntent('monte uma equipe de agentes')).toBe('agent-orchestration');
  });

  it('routes scanned documents to OCR', () => {
    const plan = buildCognitivePlan({ text: 'extraia o texto', hasDocument: true });
    expect(plan.intent).toBe('document-ocr');
    expect(plan.steps.some((s) => s.capability === 'ocr')).toBe(true);
  });

  it('retrieves relevant memory and deduplicates it', () => {
    const rows = retrieveMemory('prazo cliente retorno', [
      { id: '1', text: 'Prazo de retorno do cliente vence amanhã.', source: 'case' },
      { id: '2', text: 'Prazo de retorno do cliente vence amanhã.', source: 'case' },
      { id: '3', text: 'Configuração visual do dashboard.', source: 'ui' },
    ]);
    expect(rows.length).toBe(1);
    expect(rows[0].id).toBe('1');
  });

  it('blocks unresolved provider failures', () => {
    const result = runQualityGate({ text: 'Não consegui concluir. Falha: providers indisponíveis.' });
    expect(result.ok).toBe(false);
  });
});
