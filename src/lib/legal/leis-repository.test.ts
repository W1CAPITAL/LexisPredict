import {afterEach,describe,expect,it,vi} from 'vitest';
import {
  detectLegislationReference,extractArticleExcerpt,parseLawHeader,
  retrieveLegislationEvidence,formatLegislationEvidence
} from './leis-repository';

afterEach(()=>vi.unstubAllGlobals());

describe('LexisPredict legislation specialist',()=>{
  it('resolves common legal names and articles without LLM',()=>{
    expect(detectLegislationReference('Qual o art. 42 do CDC?')).toEqual({
      kind:'lei-ordinaria',number:8078,year:1990,article:42
    });
    expect(detectLegislationReference('art. 300 do CPC')).toMatchObject({number:13105,year:2015,article:300});
    expect(detectLegislationReference('Lei Complementar nº 64/1990 art. 1º')).toMatchObject({
      kind:'lei-complementar',number:64,year:1990,article:1
    });
    expect(detectLegislationReference('Lei nº 10.406/2002')).toMatchObject({number:10406,year:2002});
  });

  it('does not treat a CNJ or an article without identified law as legislation',()=>{
    expect(detectLegislationReference('processo 4019639-59.2025.8.26.0001')).toBeNull();
    expect(detectLegislationReference('art. 42')).toBeNull();
    expect(detectLegislationReference('Lei 1000000/2002')).toBeNull();
  });

  it('extracts exact article without blending subsequent articles',()=>{
    const raw=[
      '# Lei',
      '**Art. 42.** Cobrança de dívidas.',
      'Parágrafo único. Texto de teste.',
      '**Art. 43.** Dados e cadastros.',
      '**Art. 420.** Outro artigo.'
    ].join('\n');
    expect(extractArticleExcerpt(raw,42)).toContain('Parágrafo único.');
    expect(extractArticleExcerpt(raw,42)).not.toContain('Dados e cadastros');
    expect(extractArticleExcerpt(raw,420)).toContain('Outro artigo.');
    expect(extractArticleExcerpt(raw,99)).toBeNull();
  });

  it('retrieves source and date with an exact directory + file lookup',async()=>{
    const entries=[{name:'lei-8078-1990-09-11.md',path:'federal/leis-ordinarias/1990/lei-8078-1990-09-11.md',type:'file',size:5000}];
    const law=[
      '---','titulo: "Lei nº 8.078 de 11/09/1990"','tipo: "Lei Ordinária"',
      'numero: "8078"','data: 1990-09-11','versao_texto: "compilada (texto vigente)"',
      'revogada: false','fonte: "https://normas.leg.br/?urn=abc"',
      'baixado_em: 2026-10-20','---',
      '**Art. 42.** O consumidor tem proteção no texto da lei.',
      '**Art. 43.** Outro dispositivo.'
    ].join('\n');
    const spy=vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(entries),{status:200}))
      .mockResolvedValueOnce(new Response(law,{status:200}));
    vi.stubGlobal('fetch',spy);
    const result=await retrieveLegislationEvidence('art. 42 do CDC');
    expect(result?.found).toBe(true);
    expect(result?.excerpt).toContain('Art. 42.');
    expect(result?.excerpt).not.toContain('Art. 43.');
    expect(result?.officialUrl).toContain('normas.leg.br');
    expect(formatLegislationEvidence(result)).toContain('NÃO INSTRUÇÕES');
    expect(spy).toHaveBeenCalledTimes(2);
    const args=spy.mock.calls.map(call=>String(call[0]));
    expect(args[0]).toContain('/1990');
    expect(args[0]).not.toContain('4019639-59');
  });

  it('fails closed on mismatched metadata',async()=>{
    vi.stubGlobal('fetch',vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([
        {name:'lei-8078-1990-09-11.md',path:'federal/leis-ordinarias/1990/lei-8078-1990-09-11.md',type:'file'}
      ])))
      .mockResolvedValueOnce(new Response('---\nnumero: "9999"\ndata: 1990-09-11\n---\n**Art. 42.** Texto errado.')));
    const result=await retrieveLegislationEvidence('art. 42 CDC');
    expect(result?.found).toBe(false);
    expect(formatLegislationEvidence(result)).toContain('Não inventar artigo');
  });

  it('parses source metadata independently of the article',()=>{
    const meta=parseLawHeader('---\ntitulo: "Lei de exemplo"\nrevogada: false\n---\n# Lei');
    expect(meta.titulo).toBe('Lei de exemplo');
    expect(meta.revogada).toBe('false');
  });
});
