import {describe,it,expect} from 'vitest';
import {JURISPANEL_TOTAL_TIPOS,JURISPANEL_TIPOS_LISTA,preencherModeloAutor,criarEstruturaAutoral} from './jurispanel-templates';
describe('JurisPanel legal templates safety',()=>{
 it('offers the full 46-type category catalog without claiming verified petitions',()=>{
  expect(JURISPANEL_TOTAL_TIPOS).toBe(46);
  expect(new Set(JURISPANEL_TIPOS_LISTA.map(x=>x.titulo)).size).toBe(46);
 });
 it('renders author-supplied variables without evaluating markup or code',()=>{
  const text=preencherModeloAutor('Processo {{CNJ}} / {{CLIENTE}} / {{FATOS}}',{
   cnj:'0000000',cliente:'Teste',fatos:'<script>alert(1)</script>',fundamentos:'',pedidos:''
  });
  expect(text).toContain('<script>alert(1)</script>');
  expect(text).not.toContain('{{');
 });
 it('uses a transparent unverified drafting disclaimer',()=>{
  const text=criarEstruturaAutoral('Recurso de Revista');
  expect(text).toContain('REVISÃO POR PROFISSIONAL HABILITADO');
  expect(text).toContain('{{FUNDAMENTOS}}');
 });
});