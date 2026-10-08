import { describe, expect, it } from 'vitest';
import { normalizeOfficialUrl, explicitOfficialResearchUrls } from './spider-sources';

describe('Spider research safety', () => {
  it('allows official HTTPS legal publications', () => {
    expect(normalizeOfficialUrl('https://www.cnj.jus.br/consulta')).toContain('cnj.jus.br');
  });
  it('blocks private hosts, non-HTTPS and lookalike hosts', () => {
    expect(normalizeOfficialUrl('http://stj.jus.br/')).toBeNull();
    expect(normalizeOfficialUrl('https://localhost/')).toBeNull();
    expect(normalizeOfficialUrl('https://cnj.jus.br.evil.example/')).toBeNull();
    expect(normalizeOfficialUrl('https://127.0.0.1/')).toBeNull();
    expect(normalizeOfficialUrl('https://evil.gov.br.evil.example/')).toBeNull();
  });
  it('requires explicit research intent and limits page count', () => {
    expect(explicitOfficialResearchUrls('Veja https://www.cnj.jus.br/')).toHaveLength(0);
    expect(explicitOfficialResearchUrls('Pesquise https://www.cnj.jus.br/a e https://www.stj.jus.br/b e https://www.stf.jus.br/c')).toHaveLength(2);
  });
  it('rejects embedded credentials and tokens', () => {
    expect(normalizeOfficialUrl('https://u:p@www.cnj.jus.br/')).toBeNull();
    expect(normalizeOfficialUrl('https://www.cnj.jus.br/?token=abc')).toBeNull();
  });
});
