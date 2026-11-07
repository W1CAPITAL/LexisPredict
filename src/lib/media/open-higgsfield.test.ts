import { describe,it,expect } from 'vitest';
import { openHiggsfieldConfig,validateHiggsVideo,openHiggsfieldModels,
  openHiggsfieldStatus,openHiggsfieldGenerate,openHiggsfieldTask } from './open-higgsfield';
const env={NODE_ENV:'production',OPEN_HIGGSFIELD_BASE_URL:'https://studio.w1.example',
  OPEN_HIGGSFIELD_ACCESS_CLIENT_ID:'demo-id',OPEN_HIGGSFIELD_ACCESS_CLIENT_SECRET:'demo-secret',
  OPEN_HIGGSFIELD_GENERATION_ENABLED:'true'};
const calls:Array<{url:string;init:RequestInit}>=[];
const fakeFetch:typeof fetch=async(url,init={})=>{
  const path=String(url);calls.push({url:path,init});
  if(path.endsWith('/api/ready'))return Response.json({ready:true});
  if(path.endsWith('/api/models'))return Response.json({model_list:[{
    id:'veo-3',label:'Veo 3',provider:'google',duration:{options:['5','10']},
    aspect_ratio:{options:[['Vertical','9:16']]}}]});
  if(path.endsWith('/api/generate'))return Response.json({accepted:true,recovery_required:false,task_id:'task_123'},{status:202});
  if(path.endsWith('/api/tasks/task_123'))return Response.json({
    task_id:'task_123',media_type:'video',status:'COMPLETED',has_download:true});
  throw Error('Unexpected URL');
};
describe('Open-Higgsfield protected integration',()=>{
  it('fails closed on missing Cloudflare service credentials, unsafe URL or URL credentials',()=>{
    expect(openHiggsfieldConfig({...env,OPEN_HIGGSFIELD_ACCESS_CLIENT_SECRET:''}).configured).toBe(false);
    expect(openHiggsfieldConfig({...env,OPEN_HIGGSFIELD_BASE_URL:'http://public.example'}).configured).toBe(false);
    expect(openHiggsfieldConfig({...env,OPEN_HIGGSFIELD_BASE_URL:'https://alice:password@public.example'}).configured).toBe(false);
  });
  it('rejects path traversal, empty prompts and unsupported ratios',()=>{
    expect(()=>validateHiggsVideo({modelId:'../evil',prompt:'teste válido'})).toThrow();
    expect(()=>validateHiggsVideo({modelId:'veo-3',prompt:'x'})).toThrow();
    expect(()=>validateHiggsVideo({modelId:'veo-3',prompt:'uma cena',aspectRatio:'bad'})).toThrow();
  });
  it('reads connected models, status and task without revealing provider credentials',async()=>{
    expect((await openHiggsfieldStatus({env,fetcher:fakeFetch})).ready).toBe(true);
    expect((await openHiggsfieldModels({env,fetcher:fakeFetch}))[0].ratios).toEqual(['9:16']);
    expect((await openHiggsfieldTask('task_123',{env,fetcher:fakeFetch})).readyToDownload).toBe(true);
  });
  it('posts exactly one multipart generation with protected origin',async()=>{
    calls.length=0;
    const result=await openHiggsfieldGenerate({modelId:'veo-3',prompt:'Mostre um vídeo dinâmico.',duration:'5',
      aspectRatio:'9:16'},{env,fetcher:fakeFetch});
    expect(result).toEqual({accepted:true,recoveryRequired:false,taskId:'task_123'});
    const call=calls.find(x=>x.url.endsWith('/api/generate'));
    expect(call).toBeTruthy();
    expect((call!.init.headers as Record<string,string>).Origin).toBe('https://studio.w1.example');
    expect((call!.init.headers as Record<string,string>)['CF-Access-Client-Secret']).toBe('demo-secret');
    expect((call!.init.body as FormData).get('model_id')).toBe('veo-3');
    expect(JSON.parse(String((call!.init.body as FormData).get('settings'))).duration).toBe('5');
    expect(calls.filter(x=>x.url.endsWith('/api/generate'))).toHaveLength(1);
  });
  it('treats an uncertain upstream submission as review-required, not a safe retry',async()=>{
    const uncertainFetch:typeof fetch=async(url,init={})=>{
      if(String(url).endsWith('/api/models'))return fakeFetch(url,init);
      if(String(url).endsWith('/api/generate'))
        return Response.json({accepted:false,recovery_required:true,task_id:'uncertain_1'},{status:503});
      throw Error('Unexpected URL');
    };
    const result=await openHiggsfieldGenerate({modelId:'veo-3',prompt:'Uma cena de demonstração.'},
      {env,fetcher:uncertainFetch});
    expect(result.accepted).toBe(false);
    expect(result.recoveryRequired).toBe(true);
    expect(result.taskId).toBe('uncertain_1');
  });
  it('never submits when disabled or model is unavailable',async()=>{
    calls.length=0;
    await expect(openHiggsfieldGenerate({modelId:'veo-3',prompt:'uma cena'},{env:{
      ...env,OPEN_HIGGSFIELD_GENERATION_ENABLED:'false'},fetcher:fakeFetch})).rejects.toThrow();
    expect(calls).toHaveLength(0);
    await expect(openHiggsfieldGenerate({modelId:'not-connected',prompt:'uma cena'},{env,fetcher:fakeFetch})).rejects.toThrow();
    expect(calls.filter(x=>x.url.endsWith('/api/generate'))).toHaveLength(0);
  });
});
