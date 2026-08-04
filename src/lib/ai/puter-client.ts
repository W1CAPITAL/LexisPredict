/**
 * Puter.js — fallback CLIENT-SIDE (User-Pays).
 * Carrega CDN só no browser. Sem API key no seu servidor.
 *
 * Modelo recomendado para rascunho ao cliente: gpt-5.4-nano ou x-ai/grok-4-1-fast
 * Docs: https://js.puter.com/v2/
 *
 * ATENÇÃO: não envie secrets/processos sensíveis em massa; use só o prompt de atendimento.
 */

declare global {
  interface Window {
    puter?: {
      ai?: {
        chat: (
          prompt: string,
          opts?: { model?: string; stream?: boolean; temperature?: number; max_tokens?: number }
        ) => Promise<any>;
      };
    };
  }
}

let loading: Promise<void> | null = null;

export function loadPuterScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Puter só no browser'));
  if (window.puter?.ai?.chat) return Promise.resolve();
  if (loading) return loading;

  loading = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-puter]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://js.puter.com/v2/';
    s.async = true;
    s.dataset.puter = '1';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Falha ao carregar Puter.js'));
    document.head.appendChild(s);
  });
  return loading;
}

function extractText(response: any): string {
  if (typeof response === 'string') return response;
  if (response?.message?.content) {
    const c = response.message.content;
    if (typeof c === 'string') return c;
    if (Array.isArray(c) && c[0]?.text) return c[0].text;
  }
  if (response?.text) return String(response.text);
  return String(response ?? '');
}

export async function puterChat(
  prompt: string,
  opts?: { model?: string; temperature?: number }
): Promise<{ text: string; engine: string }> {
  await loadPuterScript();
  if (!window.puter?.ai?.chat) throw new Error('Puter indisponível');

  const model = opts?.model || 'gpt-5.4-nano';
  const response = await window.puter.ai.chat(prompt, {
    model,
    temperature: opts?.temperature ?? 0.45,
  });

  return { text: extractText(response), engine: `PUTER:${model}` };
}

/** Prompt seguro para mensagem ao cliente (sem dados internos de marca) */
export function buildClientReplyPrompt(ctx: {
  cliente: string;
  protocolo: string;
  evento?: string;
  resumo?: string;
  ancora?: string;
}): string {
  return `Redija UMA mensagem curta (WhatsApp) ao cliente, em português do Brasil.
Cliente: ${ctx.cliente}
Processo: ${ctx.protocolo}
Evento: ${ctx.evento || 'atualização'}
Resumo: ${ctx.resumo || '—'}
Base (não contradiga): ${ctx.ancora || 'Informar que a equipe analisa e retorna.'}
Regras: sem inventar decisão; sem citar empresas; tom profissional e humano; 4 a 7 linhas.`;
}
