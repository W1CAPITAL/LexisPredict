import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {fetchCarteiraAllClient,invalidateCarteiraClientCache} from './carteira-fetch-client';

const data=Array.from({length:2735},(_,i)=>({id:String(i+1),protocolo:'CNJ-'+(i+1),cliente:'Caso '+(i+1)}));
describe('carteira da empresa sem centenas de cliques',()=>{
 beforeEach(()=>{
  const storage=new Map<string,string>();
  vi.stubGlobal('localStorage',{
   getItem:(k:string)=>storage.get(k)||null,
   setItem:(k:string,v:string)=>{storage.set(k,v);},
   removeItem:(k:string)=>{storage.delete(k);}
  });
  vi.stubGlobal('window',{setTimeout:globalThis.setTimeout});
  vi.stubGlobal('fetch',vi.fn(async (input:string)=>{
   const u=new URL(String(input),'http://127.0.0.1');
   const offset=Number(u.searchParams.get('offset')||0),limit=Number(u.searchParams.get('limit')||0);
   return {ok:true,headers:{get:()=> 'application/json'},
    json:async()=>({ok:true,cases:data.slice(offset,offset+limit)})};
  }));
  invalidateCarteiraClientCache();
 });
 afterEach(()=>{invalidateCarteiraClientCache();vi.unstubAllGlobals();});
 it('recupera a carteira completa por lotes sem cliques ou serializar JSON detalhado',async()=>{
  const seen:number[]=[];
  const rows=await fetchCarteiraAllClient({
   empresaId:'tenant-w1',userId:'auth-w1',scope:'empresa',
   firstPageSize:30,pageSize:200,
   onPage:page=>seen.push(page.length)
  });
  expect(rows).toHaveLength(2735);
  expect(seen[0]).toBe(30);
  expect(seen.at(-1)).toBe(2735);
  expect(new Set(rows.map(row=>row.id)).size).toBe(2735);
  expect(fetch).toHaveBeenCalledTimes(15);
  const uris=vi.mocked(fetch).mock.calls.map(x=>String(x[0]));
  expect(uris.every(u=>u.includes('details=0')&&u.includes('scope=empresa'))).toBe(true);
 });
 it('a tela processos usa carregamento completo automático e pode cancelar lote obsoleto',()=>{
  const src=readFileSync(new URL('../app/processos/page.tsx',import.meta.url),'utf8');
  expect(src).toContain('fetchCarteiraAllClient(');
  expect(src).toContain('shouldContinue:');
  expect(src).not.toContain('onLoadMore={loadMoreFromServer}');
 });
 it('o banco usa ordem estável no desempate para não perder registros entre páginas',()=>{
  const src=readFileSync(new URL('server-db.ts',import.meta.url),'utf8');
  const start=src.indexOf('export async function getStoredCasesPageForEmpresa(');
  const end=src.indexOf('export async function listKnowledgeDocs',start);
  const query=src.slice(start,end);
  expect(query).toContain(".order('created_at', { ascending: false })");
  expect(query).toContain(".order('id', { ascending: false })");
  expect(query).toContain(".range(offset, offset + limit - 1)");
 });
 it('as telas operacionais não escondem a carteira atrás de páginas manuais',()=>{
  const processos=readFileSync(new URL('../components/processos/processos-command-center.tsx',import.meta.url),'utf8');
  const tarefas=readFileSync(new URL('../app/tarefas/page.tsx',import.meta.url),'utf8');
  const vencidos=readFileSync(new URL('../components/vencidos/vencidos-panel.tsx',import.meta.url),'utf8');
  const supervisao=readFileSync(new URL('../app/supervisao/page.tsx',import.meta.url),'utf8');
  expect(processos).toContain('useAutoLoadMore');
  expect(processos).toContain('useState(true)');
  expect(processos).not.toContain('const PAGE = props.query.trim().length >= 2 ? 200 : 10;');
  expect(processos).not.toContain('for (const c of props.items)');
  expect(tarefas).toContain('return <TarefasPageLegacy/>;');
  expect(tarefas).toContain('somenteMeta ? dailyMeta : pending.length');
  expect(tarefas).toContain('useAutoLoadMore');
  expect(vencidos).toContain('useAutoLoadMore');
  expect(supervisao).toContain('useAutoLoadMore');
  expect(supervisao).not.toContain('Ver mais processos (');
 });

});