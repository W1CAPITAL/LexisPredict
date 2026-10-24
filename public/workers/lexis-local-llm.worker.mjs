/* Browser-only model. Does not send user prompts to a hosted inference endpoint.
 * Pinned Transformers.js v3 and quantized Qwen 0.5B ONNX, downloaded/cached on first use.
 */
const MODEL = 'onnx-community/Qwen2.5-0.5B-Instruct';
let generator = null;
let generatorDevice = null;
let loading = null;
function emit(requestId, status, extra = {}) {
  self.postMessage({ requestId, status, ...extra });
}
async function initialize(requestId, requireWebGpu = false) {
  if (generator) {
    if(requireWebGpu && generatorDevice !== 'webgpu') throw new Error('Este modelo já foi inicializado em CPU. Reabra a aba e use uma GPU compatível para evitar sobrecarga.');
    return generator;
  }
  // Hard safety gate. A CPU/WASM fallback on an 8GB PC can freeze the entire browser.
  // WebGPU must exist BEFORE we download hundreds of MB of weights.
  const memory=Number(self.navigator?.deviceMemory||0);
  if(memory && memory<8)throw new Error('Memória disponível no navegador é insuficiente para Qwen 0.5B. Use o motor Lexis (scripts) ou inferência remota no servidor.');
  let adapter=null;
  try {adapter=await self.navigator?.gpu?.requestAdapter?.({powerPreference:'low-power'});}
  catch{/* reject below */}
  if(!adapter)throw new Error('WebGPU indisponível. Por segurança, o Lexis não executa o Qwen 0.5B na CPU deste navegador. Escolha o motor de scripts ou um servidor próprio.');
  if (loading) return loading;
  loading = (async () => {
    emit(requestId, 'loading', { message: 'Carregando o motor local no navegador...' });
    // Give a clear, actionable error if the site security header, CDN, or
    // local network prevents model downloads. The URL is pinned to a public
    // tokenizer configuration, never sends the user's prompt.
    try {
      const probe = await fetch('https://huggingface.co/onnx-community/Qwen2.5-0.5B-Instruct/resolve/main/config.json', {
        cache: 'force-cache', signal: AbortSignal.timeout(12000),
      });
      if (!probe.ok) throw new Error('Hugging Face respondeu HTTP ' + probe.status);
    } catch (e) {
      throw new Error('Não foi possível acessar os arquivos do Qwen no Hugging Face. Verifique a rede ou bloqueios do navegador (CSP). Detalhe: ' + String(e?.message || e));
    }
    emit(requestId,'loading',{message:'Baixando carregador Transformers.js...'});
    let lib;
    try {
      lib = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1');
    } catch(e) {
      throw new Error('Não foi possível carregar Transformers.js da CDN. Verifique bloqueios de extensões, a rede e a política CSP. Detalhe: ' + String(e?.message || e));
    }
    const progress_callback = p => {
      if (p?.status === 'progress') {
        emit(requestId, 'progress', { progress: Math.max(0, Math.min(100, Math.round(p.progress || 0))), file: String(p.file || '') });
      } else if (p?.status === 'initiate') {
        emit(requestId, 'loading', { message: 'Baixando modelo local pela primeira vez...' });
      }
    };
    // GPU-only: no silent CPU fallback and no secondary q8 model allocation.
    const opts={dtype:'q4',device:'webgpu',progress_callback};
    try {
      generator=await lib.pipeline('text-generation',MODEL,opts);
      generatorDevice='webgpu';
    } catch(error){
      generator=null;
      throw new Error('Não foi possível iniciar o Qwen em WebGPU sem sobrecarregar o PC: '+String(error?.message||error).slice(0,160));
    }
    return generator;
  })();
  try { return await loading; }
  finally { loading = null; }
}
let running = false;
self.onmessage = async event => {
  const { requestId, prompt, history, maxTokens } = event.data || {};
  if (!requestId || typeof prompt !== 'string') return;
  if (running) {
    emit(requestId, 'error', { error: 'O modelo local já está respondendo. Aguarde.' });
    return;
  }
  running = true;
  try {
    const model = await initialize(requestId, true);
    emit(requestId, 'generating', { message: 'Gerando resposta sem enviar sua pergunta a uma API externa...' });
    const recent = Array.isArray(history) ? history.filter(x => x?.role === 'user' || x?.role === 'assistant').slice(-2) : [];
    const messages = [
      { role: 'system', content: 'Você é o Assistente LexisPredict, um modelo leve executado no navegador. Responda em português do Brasil, com clareza. Não invente fatos, decisões ou datas processuais. Se não tiver informações, diga que não sabe. Não afirme ter consultado DataJud ou DJEN.' },
      ...recent.map(x => ({ role: x.role, content: String(x.content || '').slice(0, 400) })),
      { role: 'user', content: prompt.slice(0, 1500) },
    ];
    const generated = await model(messages, {
      max_new_tokens: Math.max(16, Math.min(96, Number(maxTokens) || 64)),
      do_sample: false,
      return_full_text: false,
    });
    const raw = generated?.[0]?.generated_text;
    let text = typeof raw === 'string' ? raw : Array.isArray(raw) ? String(raw.at(-1)?.content || '') : '';
    text = text.replace(/<\|im_end\|>|<\|eot_id\|>/g, '').trim();
    if (!text) throw new Error('Modelo local retornou resposta vazia.');
    emit(requestId, 'complete', { text, model: MODEL, device: 'webgpu' });
  } catch (error) {
    emit(requestId, 'error', { error: String(error?.message || error).slice(0, 300) });
  } finally {
    running = false;
  }
};
