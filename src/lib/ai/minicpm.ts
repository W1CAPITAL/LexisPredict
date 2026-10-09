/**
 * MiniCPM 5 / MiniCPM-V via a dedicated OpenAI-compatible endpoint.
 * Supports Ollama, llama.cpp and vLLM through their /v1 API.
 * No model weights or API keys are installed in Vercel.
 */
import type { ChatTurn, VisionImage } from './cascade';

export function miniCpmConfig(env: Record<string, string | undefined> = process.env) {
  const raw = (env.MINICPM_BASE_URL || env.OLLAMA_BASE_URL || '').trim().replace(/^["']|["']$/g, '');
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && !(env.NODE_ENV !== 'production' && url.protocol === 'http:')) return null;
    if (url.username || url.password || url.search || url.hash) return null;
    let path = url.pathname.replace(/\/+$/g, '');
    if (path.endsWith('/chat/completions')) path = path.slice(0, -'/chat/completions'.length);
    if (!path.endsWith('/v1')) path += '/v1';
    url.pathname = path + '/chat/completions';
    const timeout = Number(env.MINICPM_TIMEOUT_MS || 40000);
    return {
      endpoint: url.toString(),
      model: String(env.MINICPM_MODEL || 'auto').trim(),
      key: env.MINICPM_API_KEY || '',
      timeoutMs: Number.isFinite(timeout) ? Math.max(3000, Math.min(110000, timeout)) : 40000,
    };
  } catch { return null; }
}
type Config = NonNullable<ReturnType<typeof miniCpmConfig>>;
function auth(config: Config): Record<string,string> {
  return config.key ? { Authorization: 'Bearer ' + config.key } : {};
}
function modelsUrl(endpoint: string) {return endpoint.replace(/\/chat\/completions$/, '/models');}

export async function availableMiniCpmModels(config: Config) {
  const res = await fetch(modelsUrl(config.endpoint), {
    method: 'GET', headers: auth(config), signal: AbortSignal.timeout(5000), cache: 'no-store',
  });
  if (!res.ok) throw new Error('MiniCPM /models HTTP ' + res.status);
  const parsed = await res.json();
  const ids: string[] = Array.isArray(parsed?.data) ?
    parsed.data.map((m: any) => String(m?.id || '')).filter(Boolean) : [];
  return ids.filter(id => /minicpm/i.test(id));
}
export async function probeMiniCpm() {
  const cfg = miniCpmConfig();
  if (!cfg) return {configured:false,reachable:false,model:null,reason:'MINICPM_BASE_URL não configurada'};
  try {
    const models = await availableMiniCpmModels(cfg);
    const model = cfg.model === 'auto' ? models[0] : models.find(x => x === cfg.model);
    if (!model) throw new Error('Modelo MiniCPM não carregado no servidor');
    return {configured:true,reachable:true,model,reason:null};
  } catch {
    return {configured:true,reachable:false,model:null,reason:'Servidor não respondeu ou MiniCPM não está carregado'};
  }
}
export async function callMiniCpm(
  messages: ChatTurn[],
  opts: {maxTokens?:number;temperature?:number;images?:VisionImage[]} = {}
) {
  const cfg = miniCpmConfig();
  if (!cfg) throw new Error('MINICPM_BASE_URL não configurada');
  const models = await availableMiniCpmModels(cfg);
  const model = cfg.model === 'auto' ? models[0] : models.find(x => x === cfg.model);
  if (!model) throw new Error('MiniCPM não consta em /v1/models');
  const visual = (opts.images || []).length > 0;
  if (visual && !/[-/]v(?:ision)?[-/:]|minicpm-v/i.test(model)) {
    throw new Error('Imagens exigem servidor MiniCPM-V; MiniCPM textual não interpreta anexos.');
  }
  const prepared = messages.slice(-10).map(m => ({role:m.role,content:String(m.content).slice(0,12000)})) as Array<{role:string;content:any}>;
  if (visual) {
    const last = [...prepared].reverse().find(m => m.role === 'user');
    if (last) last.content = [
      {type:'text',text:last.content},
      ...(opts.images || []).slice(0,2).map(i => ({type:'image_url',image_url:{url:'data:' + i.mediaType + ';base64,' + i.data}})),
    ];
  }
  const started = Date.now();
  const res = await fetch(cfg.endpoint, {
    method:'POST',
    headers:{'Content-Type':'application/json', ...auth(cfg)},
    body:JSON.stringify({model,messages:prepared,stream:false,max_tokens:Math.min(2048, Math.max(32, opts.maxTokens || 512)),temperature:opts.temperature ?? 0.35}),
    signal:AbortSignal.timeout(cfg.timeoutMs),
    cache:'no-store',
  });
  if (!res.ok) throw new Error('MiniCPM HTTP ' + res.status);
  const parsed = await res.json();
  const content = parsed?.choices?.[0]?.message?.content;
  const text = typeof content === 'string' ? content : Array.isArray(content) ?
    content.filter((x:any)=>x?.type==='text').map((x:any)=>String(x.text||'')).join('\n') : '';
  if (!text.trim()) throw new Error('MiniCPM retornou resposta vazia');
  return {text:text.trim(),model:String(parsed?.model || model),latencyMs:Date.now()-started};
}
