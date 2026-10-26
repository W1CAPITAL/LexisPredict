import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {fetchCarteiraAllClient,invalidateCarteiraClientCache} from './carteira-fetch-client';

const tenant='empresa-test-refresh';
const user='auth-test-refresh';
const opts={empresaId:tenant,userId:user,scope:'mine' as const,firstPageSize:20,pageSize:40};

describe('P0 /tarefas: leitura fresca da carteira após alterações',()=>{
  beforeEach(()=>{
    const data=new Map<string,string>();
    vi.stubGlobal('localStorage',{
      getItem:(key:string)=>data.get(key)||null,
      setItem:(key:string,value:string)=>{data.set(key,value);},
      removeItem:(key:string)=>{data.delete(key);},
    });
    vi.stubGlobal('window',{setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout});
    invalidateCarteiraClientCache();
    vi.stubGlobal('fetch',vi.fn(async()=>({
      ok:true,
      headers:{get:()=> 'application/json'},
      json:async()=>({ok:true,cases:[{id:'1',protocolo:'teste-1',cliente:'Processo de teste'}]}),
    })));
  });
  afterEach(()=>{
    invalidateCarteiraClientCache();
    vi.unstubAllGlobals();
  });

  it('reuses a fresh page normally but bypasses it on forced reload',async()=>{
    await fetchCarteiraAllClient(opts);
    await fetchCarteiraAllClient(opts);
    expect(fetch).toHaveBeenCalledTimes(1);

    await fetchCarteiraAllClient({...opts,force:true});
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('keeps pages isolated between users and tenants',async()=>{
    await fetchCarteiraAllClient(opts);
    await fetchCarteiraAllClient({...opts,userId:'outro-usuario'});
    await fetchCarteiraAllClient({...opts,empresaId:'outra-empresa'});
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
