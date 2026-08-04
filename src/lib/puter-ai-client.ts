/**
 * Puter.js — fallback cliente (user-pays), sem chave no Vercel.
 * Carregar script: https://js.puter.com/v2/
 * NÃO usar repos "Grok API free" não oficiais em produção.
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

export function ensurePuterScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.puter?.ai?.chat) return Promise.resolve();
  return new Promise((resolve, reject) => {
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
}

export async function puterChat(
  prompt: string,
  model = 'x-ai/grok-3'
): Promise<{ success: boolean; text?: string; error?: string }> {
  try {
    await ensurePuterScript();
    if (!window.puter?.ai?.chat) {
      return { success: false, error: 'Puter.js indisponível' };
    }
    const response = await window.puter.ai.chat(prompt, { model });
    const text =
      typeof response === 'string'
        ? response
        : response?.message?.content?.[0]?.text ||
          response?.message?.content ||
          response?.text ||
          JSON.stringify(response);
    return { success: true, text: String(text) };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Puter falhou' };
  }
}
