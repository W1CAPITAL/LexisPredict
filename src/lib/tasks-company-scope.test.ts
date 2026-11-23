import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
it('/tarefas consulta por padrão os processos de toda a organização; RLS valida empresa no backend',()=>{
 const source=readFileSync(new URL('../app/tarefas/page.tsx',import.meta.url),'utf8');
 expect(source).toContain("const taskCaseScope = 'empresa' as const;");
 expect(source).toContain('scope: taskCaseScope');
 const server=readFileSync(new URL('../app/api/carteira/fast/route.ts',import.meta.url),'utf8');
 expect(server).toContain('const ctx = await getUserContext()');
 expect(server).toContain('companyReadOnly: scope ===');
});
