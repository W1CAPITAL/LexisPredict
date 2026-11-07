/** Open-Higgsfield (TechBeme, MIT) external adapter. No embedded models or keys. */
export type HiggsEnv = Record<string, string | undefined>;
export type HiggsVideo = { modelId: string; prompt: string; duration?: string; aspectRatio?: string };
export type HiggsModel = { id:string; label:string; provider:string; durations:string[]; ratios:string[] };
type Options = { env?:HiggsEnv; fetcher?:typeof fetch; timeout?:number };

export function openHiggsfieldConfig(env:HiggsEnv=process.env) {
  const raw=(env.OPEN_HIGGSFIELD_BASE_URL||'').trim();
  if (!raw) return {configured:false as const, reason:'Instância Open-Higgsfield não configurada.'};
  try {
    const u=new URL(raw), local=['localhost','127.0.0.1','[::1]'].includes(u.hostname);
    if(u.username||u.password||u.search||u.hash||u.pathname!=='/'||
      (u.protocol!=='https:' && !(env.NODE_ENV!=='production' && local && u.protocol==='http:'))) throw Error('invalid URL');
    const id=(env.OPEN_HIGGSFIELD_ACCESS_CLIENT_ID||'').trim();
    const secret=(env.OPEN_HIGGSFIELD_ACCESS_CLIENT_SECRET||'').trim();
    if((!local&&(!id||!secret))||Boolean(id)!==Boolean(secret)) throw Error('unprotected URL');
    return {configured:true as const,origin:u.origin,id,secret,
      generationEnabled:env.OPEN_HIGGSFIELD_GENERATION_ENABLED==='true'};
  } catch { return {configured:false as const,
    reason:'Use URL HTTPS protegida por Cloudflare Access e configure as credenciais de serviço no servidor.'}; }
}
export function validateHiggsVideo(input:unknown):HiggsVideo {
  if(!input||typeof input!=='object'||Array.isArray(input)) throw Error('Payload inválido.');
  const v=input as Record<string,unknown>;
  const modelId=typeof v.modelId==='string'?v.modelId.trim():'';
  const prompt=typeof v.prompt==='string'?v.prompt.trim():'';
  if(!/^[A-Za-z0-9._:/-]{2,160}$/.test(modelId)||modelId.split('/').some(x=>x==='.'||x==='..')) throw Error('Modelo inválido.');
  if(prompt.length<3||prompt.length>2500) throw Error('Prompt deve conter entre 3 e 2500 caracteres.');
  const duration=v.duration==null||v.duration===''?undefined:String(v.duration);
  const aspectRatio=v.aspectRatio==null||v.aspectRatio===''?undefined:String(v.aspectRatio);
  if(duration&&!/^\d{1,3}$/.test(duration)) throw Error('Duração inválida.');
  if(aspectRatio&&!/^(9:16|16:9|1:1|4:3|3:4)$/.test(aspectRatio)) throw Error('Proporção inválida.');
  return {modelId,prompt,duration,aspectRatio};
}
async function request(path:string, opts:Options&{method?:'GET'|'POST';body?:BodyInit}={}) {
  const cfg=openHiggsfieldConfig(opts.env);
  if(!cfg.configured) throw Error(cfg.reason);
  return (opts.fetcher||fetch)(cfg.origin+path,{
    method:opts.method||'GET',body:opts.body,
    headers:{...(cfg.id?{'CF-Access-Client-Id':cfg.id,'CF-Access-Client-Secret':cfg.secret}:{}),
      ...(opts.method==='POST'?{Origin:cfg.origin}:{})},
    redirect:'error',cache:'no-store',signal:AbortSignal.timeout(opts.timeout||12000)
  });
}
async function readJson(res:Response):Promise<Record<string,unknown>> {
  const body=await res.text();
  if(body.length>2_000_000) throw Error('Resposta do estúdio muito grande.');
  let value:unknown;
  try{value=JSON.parse(body);}catch{throw Error('Resposta inválida do estúdio.');}
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Resposta inválida do estúdio.');
  if(!res.ok){
    const code=(value as Record<string,unknown>).error;
    throw Error('Open-Higgsfield HTTP '+res.status+(typeof code==='string'&&/^ERR_[A-Z0-9_]+$/.test(code)?': '+code:''));
  }
  return value as Record<string,unknown>;
}
export async function openHiggsfieldStatus(opts:Options={}) {
  const cfg=openHiggsfieldConfig(opts.env);
  if(!cfg.configured) return {configured:false,ready:false,generationEnabled:false,error:cfg.reason};
  try{
    const data=await readJson(await request('/api/ready',opts));
    return {configured:true,ready:data.ready===true,generationEnabled:cfg.generationEnabled,
      ...(data.ready===true?{}:{error:'Estúdio não está pronto.'})};
  }catch(e){return{configured:true,ready:false,generationEnabled:cfg.generationEnabled,
    error:e instanceof Error?e.message:'Servidor indisponível.'};}
}
export async function openHiggsfieldModels(opts:Options={}):Promise<HiggsModel[]> {
  const data=await readJson(await request('/api/models',opts));
  const rows=Array.isArray(data.model_list)?data.model_list:[];
  return rows.filter((x):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x))
    .filter(x=>typeof x.id==='string'&&typeof x.label==='string').slice(0,250).map(x=>{
      const duration=x.duration&&typeof x.duration==='object'&&'options'in x.duration?(x.duration as {options?:unknown}).options:undefined;
      const aspect=x.aspect_ratio&&typeof x.aspect_ratio==='object'&&'options'in x.aspect_ratio?(x.aspect_ratio as {options?:unknown}).options:undefined;
      return {id:String(x.id),label:String(x.label).slice(0,120),provider:typeof x.provider==='string'?x.provider:'',
        durations:Array.isArray(duration)?duration.map(String):[],
        ratios:Array.isArray(aspect)?aspect.map(v=>Array.isArray(v)?String(v[1]):String(v)):[]};
    });
}
export async function openHiggsfieldGenerate(input:unknown,opts:Options={}) {
  const cfg=openHiggsfieldConfig(opts.env);
  if(!cfg.configured)throw Error(cfg.reason);
  if(!cfg.generationEnabled)throw Error('Geração desligada. Configure OPEN_HIGGSFIELD_GENERATION_ENABLED=true.');
  const v=validateHiggsVideo(input);
  const model=(await openHiggsfieldModels(opts)).find(m=>m.id===v.modelId);
  if(!model)throw Error('Modelo indisponível. Conecte um provedor ao estúdio.');
  if(v.duration&&model.durations.length&&!model.durations.includes(v.duration))throw Error('Duração incompatível com modelo.');
  if(v.aspectRatio&&model.ratios.length&&!model.ratios.includes(v.aspectRatio))throw Error('Proporção incompatível com modelo.');
  const form=new FormData();
  form.set('model_id',v.modelId);form.set('prompt',v.prompt);
  form.set('settings',JSON.stringify({...(v.duration?{duration:v.duration}:{}),
    ...(v.aspectRatio?{aspectRatio:v.aspectRatio}:{})}));
  // Do not retry: a timed-out generation may already have incurred a charge.
  const data=await readJson(await request('/api/generate',{...opts,method:'POST',body:form,timeout:270000}));
  const taskId=typeof data.task_id==='string'?data.task_id:'';
  if(data.recovery_required===true)return{accepted:false,recoveryRequired:true,taskId:taskId||undefined,
    error:'Resultado incerto. Consulte histórico antes de reenviar.'};
  if(data.accepted!==true||!/^[A-Za-z0-9_-]{1,128}$/.test(taskId))
    throw Error('Geração não confirmada. Verifique histórico antes de reenviar.');
  return{accepted:true,recoveryRequired:false,taskId};
}
export async function openHiggsfieldTask(taskId:string,opts:Options={}) {
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(taskId))throw Error('Identificador inválido.');
  const data=await readJson(await request('/api/tasks/'+encodeURIComponent(taskId),opts));
  if(data.task_id!==taskId||data.media_type!=='video')throw Error('Tarefa não encontrada.');
  return{taskId,status:typeof data.status==='string'?data.status:'UNKNOWN',
    readyToDownload:data.has_download===true,recoveryRequired:data.recovery_required===true,
    error:typeof data.error_message==='string'?data.error_message:undefined};
}
export async function openHiggsfieldDownload(taskId:string,opts:Options={}) {
  const task=await openHiggsfieldTask(taskId,opts);
  if(!task.readyToDownload)throw Error('Vídeo ainda não disponível.');
  const res=await request('/api/download/'+encodeURIComponent(taskId)+'?inline=1',{...opts,timeout:60000});
  if(!res.ok)throw Error('Download falhou: HTTP '+res.status);
  if(!/^video\/(mp4|webm|quicktime)(;|$)/i.test(res.headers.get('content-type')||''))throw Error('Resposta não é um vídeo.');
  return res;
}
