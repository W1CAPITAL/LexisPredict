import {beforeEach,describe,expect,it} from 'vitest';
import {invalidateCarteiraCache,loadCarteiraComCache,peekCarteiraCache,writeCarteiraCache} from './session-carteira-cache';

const base={empresaId:'tenant-regression',scope:'mine' as const,userId:'operator-regression',viewKey:'tarefas'};
const oldRows=[{id:10,protocolo:'processo-antigo'}];

describe('P0 /tarefas: carteira esvaziada no servidor',()=>{
  beforeEach(()=>invalidateCarteiraCache());

  it('removes a scoped old snapshot after a confirmed empty hard refresh',async()=>{
    writeCarteiraCache(oldRows,base.empresaId,base.scope,base.userId,base.viewKey);
    const displayed:unknown[][]=[];
    const result=await loadCarteiraComCache({
      ...base,authoritativeEmpty:true,reuseFreshCache:false,
      fetchNetwork:async()=>[],onShow:(rows)=>displayed.push(rows),
    });
    expect(result).toEqual({cases:[],source:'empty'});
    expect(displayed.at(-1)).toEqual([]);
    expect(peekCarteiraCache(base.empresaId,base.scope,base.userId,base.viewKey)).toBeNull();
  });

  it('does not erase cached data when the remote request fails',async()=>{
    writeCarteiraCache(oldRows,base.empresaId,base.scope,base.userId,base.viewKey);
    const result=await loadCarteiraComCache({
      ...base,authoritativeEmpty:true,reuseFreshCache:false,
      fetchNetwork:async()=>{throw new Error('offline');},
      onShow:()=>{},
    });
    expect(result.source).toBe('cache');
    expect(peekCarteiraCache(base.empresaId,base.scope,base.userId,base.viewKey)?.cases).toEqual(oldRows);
  });

  it('preserves the conservative fallback for ordinary non-forced loading',async()=>{
    writeCarteiraCache(oldRows,base.empresaId,base.scope,base.userId,base.viewKey);
    const result=await loadCarteiraComCache({
      ...base,reuseFreshCache:false,
      fetchNetwork:async()=>[],onShow:()=>{},
    });
    expect(result.source).toBe('cache');
  });
});
