import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';

it('resumo analítico da supervisão só é exposto pela RPC autenticada e validada',()=>{
 const sql=readFileSync(new URL('../../supabase/migrations/20261123210000_supervisao_desktop_analises_snapshot.sql',import.meta.url),'utf8');
 expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.lexis_supervisao_analises_snapshot/i);
 expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.lexis_supervisao_analises_snapshot\(uuid,date,date\) FROM PUBLIC, anon, authenticated/i);
 expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.lexis_desktop_supervisao_snapshot/i);
 expect(sql).toMatch(/auth\.uid\(\)/i);
 expect(sql).toMatch(/Somente Supervisor ou Superadmin/i);
 expect(sql).toMatch(/'analises',public\.lexis_supervisao_analises_snapshot/i);
 expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.lexis_desktop_supervisao_snapshot\(text\) TO authenticated, service_role/i);
});
