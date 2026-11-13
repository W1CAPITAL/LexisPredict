import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';

describe('Fluxo manual de consultas nas abas operacionais',()=>{
 it('oferece DataJud e DJEN browser-first no atendimento WhatsApp',()=>{
  const source=readFileSync('src/app/whatsapp/page.tsx','utf8');
  expect(source).toContain('import { scanInteractiveCase }');
  expect(source).toContain('await scanInteractiveCase(target.protocolo');
 });
 it('usa o navegador na consulta manual individual de Processos Parados, sem substituir o lote administrado',()=>{
  const source=readFileSync('src/app/processos-parados/page.tsx','utf8');
  expect(source).toContain('await scanInteractiveCase(protocolo');
  expect(source).toContain('await scanSingleCaseAction(p,');
 });
});
