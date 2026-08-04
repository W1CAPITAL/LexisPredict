/**
 * Cliente Puter.js — zero token no servidor Vercel
 * Usa o Puter no browser do usuário
 */

declare global {
  interface Window {
    puter?: any;
  }
}

export type PuterModel =
  | "claude"
  | "grok"
  | "llama"
  | "openai"
  | "gpt-4o"
  | "claude-3-5-sonnet";

const MODEL_MAP: Record<string, string> = {
  "puter-claude": "claude-3-5-sonnet",
  "puter-grok": "grok",
  "puter-llama": "llama",
  "puter-openai": "gpt-4o",
  claude: "claude-3-5-sonnet",
  grok: "grok",
  llama: "llama",
  openai: "gpt-4o",
};

export async function ensurePuterLoaded(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (window.puter) return true;

  return new Promise((resolve) => {
    const existing = document.querySelector('script[data-puter="1"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(!!window.puter));
      setTimeout(() => resolve(!!window.puter), 2500);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://js.puter.com/v2/";
    script.async = true;
    script.dataset.puter = "1";
    script.onload = () => resolve(!!window.puter);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

export async function puterChat(params: {
  prompt: string;
  model?: string;
  system?: string;
}): Promise<{ success: boolean; text?: string; error?: string }> {
  try {
    const loaded = await ensurePuterLoaded();
    if (!loaded || !window.puter) {
      return {
        success: false,
        error: "Puter.js não carregou. Verifique a conexão.",
      };
    }

    const modelKey = params.model || "puter-claude";
    const model = MODEL_MAP[modelKey] || "claude-3-5-sonnet";

    const fullPrompt = params.system
      ? `${params.system}\n\n${params.prompt}`
      : params.prompt;

    const response = await window.puter.ai.chat(fullPrompt, {
      model,
    });

    const text =
      typeof response === "string"
        ? response
        : response?.message?.content?.[0]?.text ||
          response?.message?.content ||
          response?.text ||
          response?.content ||
          JSON.stringify(response);

    return { success: true, text: String(text || "").trim() };
  } catch (err: any) {
    console.error("[puterChat]", err);
    return {
      success: false,
      error: err?.message || "Falha ao chamar Puter AI",
    };
  }
}

/**
 * Prompt jurídico padrão (protege o escritório)
 */
export function buildLegalSystemPrompt(): string {
  return `Você é um assistente jurídico experiente de um escritório brasileiro.
Regras obrigatórias:
- Linguagem clara, direta e para leigo (sem juridiquês desnecessário).
- Nunca invente fatos ou valores.
- Nunca prometa resultado ou dinheiro na conta do cliente.
- Nunca cite nomes de empresas, escritórios ou marcas comerciais.
- Alinhe expectativas (ex: compensação de valores, abatimento de dívida).
- Mostre que o escritório está trabalhando ativamente.
- Tom profissional, calmo e protetivo para o escritório.
- Responda sempre em português do Brasil.`;
}
