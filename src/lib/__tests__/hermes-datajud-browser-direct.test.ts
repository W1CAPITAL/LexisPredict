import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Hermes: consulta isolada de DataJud no navegador', () => {
  it('oferece botão direto separado do DJEN, com caminho alternativo autorizado', () => {
    const source = readFileSync('src/components/hermes/hermes-return-review-button.tsx', 'utf8');
    expect(source).toContain('Consultar somente DataJud');
    expect(source).toContain('fetchDataJudDirectBrowser');
    expect(source).toContain('/api/datajud-search');
    expect(source).toContain('Consulta pelo navegador, sem alterar a revisão salva');
    expect(source).not.toContain('applyBrowserDataJudResultAction');
  });
});
