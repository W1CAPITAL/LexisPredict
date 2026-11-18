import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';

const paths=[
  './supabase.ts',
  './supabase/browser.ts',
  './supabase/server.ts',
  '../app/api/auth/login/route.ts',
  '../../middleware.ts',
];

describe('Compatibilidade de configurações públicas Supabase',()=>{
 it('admite chaves publishable e legacy anon em todos os acessos',()=>{
  for(const path of paths){
   const source=readFileSync(new URL(path,import.meta.url),'utf8');
   expect(source, path).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY');
   expect(source, path).toContain('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
   expect(source, path).not.toContain('sb_secret_');
  }
 });
});
