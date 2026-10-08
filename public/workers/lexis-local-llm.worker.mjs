/* Browser-only model. Does not send user prompts to a hosted inference endpoint.
 * Pinned Transformers.js v3 and quantized Qwen 0.5B ONNX, downloaded/cached on first use.
 */
const MODEL = 'onnx-community/Qwen2.5-0.5B-Instruct';
let generator = null;
let loading = null;
function emit(requestId, status, extra = {}) {
  self.postMessage({ requestId, status, ...extra });
}
async function initialize(requestId) {
  if (generator) return generator;
  if (loading) return loading;
  loading = (async () => {
    emit(requestId, 'loading', { message: 'Carregando o motor local no navegador...' });
    const lib = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1');
    const progress_callback = p => {
      if (p?.status === 'progress') {
        emit(requestId, 'progress', { progress: Math.max(0, Math.min(100, Math.round(p.progress || 0))), file: String(p.file || '') });
      } else if (p?.status === 'initiate') {
        emit(requestId, 'loading', { message: 'Baixando modelo local pela primeira vez...' });
      }
    };
    const opts = { dtype: 'q4', device: self.navigator?.gpu ? 'webgpu' : 'wasm', progress_callback };
    try {
      generator = await lib.pipeline('text-generation', MODEL, opts);
    } catch (error) {
      if (opts.device !== 'webgpu') throw error;
      emit(requestId, 'loading', { message: 'WebGPU indisponível. Tentando processador (WASM)...' });
      generator = await lib.pipeline('text-generation', MODEL, { ...opts, device: 'wasm' });
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
    const model = await initialize(requestId);
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
    emit(requestId, 'complete', { text, model: MODEL, device: self.navigator?.gpu ? 'webgpu/wasm' : 'wasm' });
  } catch (error) {
    emit(requestId, 'error', { error: String(error?.message || error).slice(0, 300) });
  } finally {
    running = false;
  }
};
