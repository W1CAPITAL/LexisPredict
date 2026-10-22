/* Browser-only model. Does not send user prompts to a hosted inference endpoint.
 * Pinned Transformers.js v3 and quantized Qwen 0.5B ONNX, downloaded/cached on first use.
 */
const MODELS = Object.freeze({ qwen3: 'onnx-community/Qwen3-0.6B-ONNX', gemma3: 'onnx-community/gemma-3-270m-it-ONNX' });
let loadedModelId = null;
let generator = null;
let loading = null;
function emit(requestId, status, extra = {}) {
  self.postMessage({ requestId, status, ...extra });
}
async function initialize(requestId, selectedModel = 'qwen3') {
  const modelId = MODELS[selectedModel] || MODELS.qwen3;
  if (loadedModelId !== modelId) { generator = null; loading = null; }
  if (generator) return generator;
  if (loading) return loading;
  loading = (async () => {
    emit(requestId, 'loading', { message: 'Carregando o motor local no navegador...' });
    // Give a clear, actionable error if the site security header, CDN, or
    // local network prevents model downloads. The URL is pinned to a public
    // tokenizer configuration, never sends the user's prompt.
    try {
      const probe = await fetch('https://huggingface.co/' + modelId + '/resolve/main/config.json', {
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
    // Disponibilidade da API não garante uma GPU utilizável. Testar o adapter
    // apenas quando o usuário invoca o LLM; pesos continuam fora do bundle.
    let gpuReady=false;
    try{gpuReady=!!(await self.navigator?.gpu?.requestAdapter?.({powerPreference:'low-power'}));}
    catch{/* CPU fallback */}
    const cores=Number(self.navigator?.hardwareConcurrency||2);
    const memory=Number(self.navigator?.deviceMemory||0);
    if(!gpuReady && memory && memory<=4){
      emit(requestId,'loading',{message:'Memória limitada detectada. Tentando Qwen 0.5B compactado na CPU; outras abas abertas podem reduzir a velocidade.'});
    }
    const opts={dtype:selectedModel === 'gemma3' ? 'fp32' : (gpuReady ? 'q4f16' : 'q4'),device:gpuReady?'webgpu':'wasm',progress_callback};
    try{
      generator=await lib.pipeline('text-generation',modelId,opts);
      loadedModelId = modelId;
    }catch(primaryError){
      emit(requestId,'loading',{message:'Ajustando compatibilidade do modelo para CPU/WASM...'});
      try{
        generator=await lib.pipeline('text-generation',modelId,{
          ...opts,device:'wasm',dtype:selectedModel === 'gemma3' ? 'fp32' : 'q4',numThreads:Math.max(1,Math.min(4,cores-1)),
        });
        loadedModelId = modelId;
      }catch(fallbackError){
        const detail=String(fallbackError?.message||primaryError);
        throw new Error(/fetch|network|load/i.test(detail)
          ? 'Download do modelo indisponível; confira rede, cache e espaço disponível. '+detail
          : 'Não foi possível executar o modelo neste navegador. '+detail);
      }
    }
    return generator;
  })();
  try { return await loading; }
  finally { loading = null; }
}
let running = false;
self.onmessage = async event => {
  const { requestId, prompt, history, maxTokens, selectedModel = 'qwen3' } = event.data || {};
  if (!requestId || typeof prompt !== 'string') return;
  if (running) {
    emit(requestId, 'error', { error: 'O modelo local já está respondendo. Aguarde.' });
    return;
  }
  running = true;
  try {
    const model = await initialize(requestId, selectedModel);
    emit(requestId, 'generating', { message: 'Gerando resposta sem enviar sua pergunta a uma API externa...' });
    const recent = Array.isArray(history) ? history.filter(x => x?.role === 'user' || x?.role === 'assistant').slice(-6) : [];
    const messages = [
      { role: 'system', content: 'Você é o Assistente LexisPredict, um modelo leve executado no navegador. Responda em português do Brasil, com clareza. Não invente fatos, decisões ou datas processuais. Se não tiver informações, diga que não sabe. Não afirme ter consultado DataJud ou DJEN.' },
      ...recent.map(x => ({ role: x.role, content: String(x.content || '').slice(0, 800) })),
      { role: 'user', content: prompt.slice(0, 2800) },
    ];
    const generated = await model(messages, {
      max_new_tokens: Math.max(32, Math.min(320, Number(maxTokens) || 200)),
      do_sample: false,
      return_full_text: false,
    });
    const raw = generated?.[0]?.generated_text;
    let text = typeof raw === 'string' ? raw : Array.isArray(raw) ? String(raw.at(-1)?.content || '') : '';
    text = text.replace(/<\|im_end\|>|<\|eot_id\|>/g, '').trim();
    if (!text) throw new Error('Modelo local retornou resposta vazia.');
    emit(requestId, 'complete', { text, model: loadedModelId || MODELS.qwen3, device: self.navigator?.gpu ? 'webgpu/wasm' : 'wasm' });
  } catch (error) {
    emit(requestId, 'error', { error: String(error?.message || error).slice(0, 300) });
  } finally {
    running = false;
  }
};
