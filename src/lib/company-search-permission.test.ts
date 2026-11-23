import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
it('busca empresarial mantém RLS e só libera execução para authenticated',()=>{
 const sql=readFileSync(new URL('../../supabase/migrations/20261123181000_carteira_search_rls_authenticated.sql',import.meta.url),'utf8');
 expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.buscar_carteira_empresa_rapido\(uuid,text,integer\) TO authenticated/i);
 expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.buscar_carteira_empresa_rapido\(uuid,text,integer\) FROM (PUBLIC|anon)/i);
 expect(sql).not.toMatch(/DISABLE ROW LEVEL SECURITY|security definer/i);
});
