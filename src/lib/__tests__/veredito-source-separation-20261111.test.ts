import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
const read=(f:string)=>readFileSync(f,'utf8');

describe('Veredito: DJEN nunca é movimento no histórico do tribunal',()=>{
 it('mantém comunicações DJEN em campo próprio e não converte em movimentação DataJud',()=>{
  const src=read('src/app/actions/search-actions.ts');
  expect(src).not.toContain('movimentos = [...movimentos, ...fromDjen]');
  expect(src).toContain('comunicacoes = djen.items');
  expect(src).toContain('comunicacoes.length');
 });
 it('Veredito não oculta publicação DJEN quando DataJud falha',()=>{
  const src=read('src/app/veredito/page.tsx');
  expect(src).toContain('timeline.comunicacoes?.length');
  expect(src).toContain('Publicações DJEN');
  expect(src).toContain('getHermesPortfolioByCnjAction');
  expect(src).toContain('Conclusões encontradas em fontes oficiais');
 });
 it('exibe evidência apenas de empresa autenticada e nunca consulta por CPF sigiloso',()=>{
  const src=read('src/app/actions/hermes-portfolio-actions.ts');
  expect(src).toContain("getUserContext");
  expect(src).toContain(".eq('empresa_id',String(ctx.empresa_id))");
  expect(src).toContain('.in(\'protocolo_ref\'');
 });
});
