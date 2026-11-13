import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';

describe('CSP de leitura oficial DataJud no navegador',()=>{
 it('autoriza somente domínio público do CNJ no connect-src',()=>{
  const config=readFileSync('next.config.ts','utf8');
  const connect=config.split('connect-src')[1]?.split(';')[0]||'';
  expect(connect).toContain('https://api-publica.datajud.cnj.jus.br');
  expect(connect).not.toContain('https://*');
 });
});
