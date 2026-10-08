'use client';
/** Comunicação tipada com Web Worker separado: o modelo não vai para o bundle principal. */
export type BrowserLocalProgress = { status: string; message?: string; progress?: number; file?: string };
type Reply = { text: string; model: string; engine: 'LOCAL_BROWSER' };

let worker: Worker | null = null;
let nextId = 0;
let active: { id: number; cancel: () => void } | null = null;

export function stopBrowserLocalLLM() {
  active?.cancel();
  active = null;
  worker?.terminate();
  worker = null;
}

export async function generateBrowserLocalLLM(
  prompt: string,
  history: Array<{ role: string; content: string }> = [],
  onProgress?: (progress: BrowserLocalProgress) => void,
): Promise<Reply> {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') {
    throw new Error('Seu navegador não suporta Web Workers para inferência local.');
  }
  if (active) throw new Error('O LLM local já está respondendo. Aguarde ou cancele.');
  const id = ++nextId;
  if (!worker) worker = new Worker('/workers/lexis-local-llm.worker.mjs', { type: 'module', name: 'lexis-local-qwen' });
  return new Promise<Reply>((resolve, reject) => {
    const current = worker!;
    const cleanup = () => {
      if (active?.id === id) active = null;
      current.removeEventListener('message', receive);
      current.removeEventListener('error', onError);
      window.clearTimeout(deadline);
    };
    const receive = (ev: MessageEvent) => {
      if (ev.data?.requestId !== id) return;
      const p = ev.data as BrowserLocalProgress & { text?: string; model?: string; error?: string };
      onProgress?.(p);
      if (p.status === 'complete') {
        cleanup();
        resolve({ text: p.text || '', model: p.model || 'Qwen2.5-0.5B-Instruct', engine: 'LOCAL_BROWSER' });
      } else if (p.status === 'error') {
        cleanup();
        reject(new Error(p.error || 'Falha no modelo local'));
      }
    };
    const onError = () => {
      cleanup();
      worker?.terminate();
      worker = null;
      reject(new Error('Não foi possível carregar o modelo local. Confira rede, espaço e memória do navegador.'));
    };
    const deadline = window.setTimeout(() => {
      cleanup();
      worker?.terminate(); worker = null;
      reject(new Error('O modelo local excedeu o tempo de carregamento. Tente novamente em um navegador com WebGPU ou mais memória.'));
    }, 8 * 60_000);
    active = { id, cancel: () => { cleanup(); reject(new Error('Geração local cancelada.')); } };
    current.addEventListener('message', receive);
    current.addEventListener('error', onError);
    current.postMessage({ requestId: id, prompt, history, maxTokens: 200 });
  });
}
