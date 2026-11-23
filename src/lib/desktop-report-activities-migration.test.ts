import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';

it('expõe apenas agregados de tarefas registradas pelo wrapper autenticado do relatório',()=>{
 const sql=readFileSync(new URL('../../supabase/migrations/20261123220000_report_atividades_registradas_authenticated.sql',import.meta.url),'utf8');
 expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.lexis_desktop_atividades_registradas_snapshot\(\s*p_empresa uuid,\s*p_owner uuid/i);
 expect(sql).toMatch(/FROM public\.tarefas_realizadas/i);
 expect(sql).toMatch(/'total'/i);
 expect(sql).toMatch(/'porResponsavel'/i);
 expect(sql).toMatch(/'contatosMarcados'/i);
 expect(sql).toMatch(/'semReferencia'/i);
 expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.lexis_desktop_atividades_registradas_snapshot\(uuid,uuid\) FROM PUBLIC, anon, authenticated/i);
 expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.lexis_desktop_relatorio_snapshot/i);
 expect(sql).toMatch(/auth\.uid\(\)/i);
 expect(sql).toMatch(/'atividadesRegistradas',public\.lexis_desktop_atividades_registradas_snapshot\(v_empresa,v_owner\)/i);
 expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.lexis_desktop_relatorio_snapshot\(text,uuid\) TO authenticated, service_role/i);
});
