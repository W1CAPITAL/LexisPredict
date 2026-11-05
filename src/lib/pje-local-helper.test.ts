import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';

describe('Conector local gratuito do PJe',()=>{
 const root='public/lexis-pje-helper/';
 it('solicita somente permissões temporárias na aba em uso',()=>{
   const manifest=JSON.parse(readFileSync(root+'manifest.json','utf8'));
   expect(manifest.manifest_version).toBe(3);
   expect(manifest.permissions).toEqual(['activeTab','scripting']);
   expect(manifest.host_permissions||[]).toEqual([]);
 });
 it('nunca lê ou envia certificado, senha nem cookies',()=>{
   const code=readFileSync(root+'popup.js','utf8');
   expect(code).toContain('chrome.scripting.executeScript');
   expect(code).not.toMatch(/document.cookie|\.getAll\(|fetch\(|XMLHttpRequest|sendBeacon/);
 });
 it('também localiza login oficial com certificado, sem autenticar ou assinar sozinho',()=>{
   const code=readFileSync(root+'popup.js','utf8');
   expect(code).toContain('safeLoginControl');
   expect(code).toContain('Acessar com certificado');
   expect(code).toContain('kind');
   expect(code).not.toMatch(/privateKey|PKCS12|readFile|certutil|PIN.*getElementById/);
 });
 it('não executa download sem escolha explícita do usuário',()=>{
   const code=readFileSync(root+'popup.js','utf8');
   expect(code).toContain("button.addEventListener('click'");
   expect(code).toContain('candidate.click()');
 });
});
