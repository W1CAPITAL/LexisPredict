import {describe,expect,it} from 'vitest';
import {needleConfig,safeNeedleQuery,formatKnowledgeEvidence,retrieveCuratedLexisEvidence} from './needle-rag';
describe('Needle retrieval privacy',()=>{
  it('is disabled unless deliberately enabled with key and collection',()=>{
    expect(needleConfig({NEEDLE_RAG_ENABLED:'0',NEEDLE_API_KEY:'abc',NEEDLE_COLLECTION_ID:'docs'})).toBeNull();
    expect(needleConfig({NEEDLE_RAG_ENABLED:'1',NEEDLE_API_KEY:'key',NEEDLE_COLLECTION_ID:'public_docs'})?.endpoint)
      .toMatch(/collections\/public_docs\/search$/);
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
