import {describe,expect,it} from 'vitest';
import {needleConfig,safeNeedleQuery,formatKnowledgeEvidence,retrieveCuratedLexisEvidence} from './needle-rag';
describe('Needle retrieval privacy',()=>{
  it('only configures a private Cactus Needle server URL',()=>{
    expect(needleConfig({NODE_ENV:'production',NEEDLE_ROUTER_URL:'http://localhost:8751'})).toBeNull();
    expect(needleConfig({NODE_ENV:'production',NEEDLE_ROUTER_URL:'https://needle.example.com'})?.endpoint)
      .toBe('https://needle.example.com/route');
  });
  it('never forwards process numbers and CPF text to optional Needle',()=>{
    expect(safeNeedleQuery('Processo nº 1234567-89.2026.8.26.0100')).toBeNull();
    expect(safeNeedleQuery('CPF 123.456.789-00')).toBeNull();
    expect(safeNeedleQuery('telefone do cliente')).toBeNull();
    expect(safeNeedleQuery('Qual a diferença entre tutela e liminar?')).toContain('liminar');
  });
  it('keeps curated retrieval available without external credentials',()=>{
    expect(Array.isArray(retrieveCuratedLexisEvidence('revisão contratual juros'))).toBe(true);
    expect(formatKnowledgeEvidence([{title:'Guia',text:'Texto',source:'Base interna Lexis'}])).toContain('Guia');
  });
});
