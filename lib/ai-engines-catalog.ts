export type EngineStatus = "ONLINE" | "OPCIONAL" | "SEMPRE" | "ZERO-TOKEN" | "OFFLINE";

export interface AiEngine {
  id: string;
  label: string;
  desc: string;
  status: EngineStatus;
  group: "oficial" | "puter" | "local";
  requiresToken?: boolean;
}

export const AI_ENGINES: AiEngine[] = [
  {
    id: "xai",
    label: "xAI GROK 4.5",
    desc: "Raciocínio jurídico sênior + RAG.",
    status: "ONLINE",
    group: "oficial",
    requiresToken: true,
  },
  {
    id: "groq-llama",
    label: "GROQ LLAMA 3.3",
    desc: "Velocidade ultra-fluida.",
    status: "ONLINE",
    group: "oficial",
    requiresToken: true,
  },
  {
    id: "gemini",
    label: "Google Gemini",
    desc: "Texto + OCR de prints. (GEMINI_API_KEY)",
    status: "OPCIONAL",
    group: "oficial",
    requiresToken: true,
  },
  {
    id: "lexis-scripts",
    label: "Motor Lexis (scripts)",
    desc: "Sugerir resposta sem API.",
    status: "SEMPRE",
    group: "local",
    requiresToken: false,
  },
  {
    id: "puter-claude",
    label: "Puter · Claude",
    desc: "Claude no browser — não gasta XAI/GROQ.",
    status: "ZERO-TOKEN",
    group: "puter",
    requiresToken: false,
  },
  {
    id: "puter-grok",
    label: "Puter · Grok",
    desc: "Grok via Puter.js — sem chave Vercel.",
    status: "ZERO-TOKEN",
    group: "puter",
    requiresToken: false,
  },
  {
    id: "puter-llama",
    label: "Puter · Llama",
    desc: "Llama via Puter — user-pays.",
    status: "ZERO-TOKEN",
    group: "puter",
    requiresToken: false,
  },
  {
    id: "puter-openai",
    label: "Puter · OpenAI",
    desc: "GPT via Puter — sem token Lexis.",
    status: "ZERO-TOKEN",
    group: "puter",
    requiresToken: false,
  },
];

export function getEngineById(id: string): AiEngine | undefined {
  return AI_ENGINES.find((e) => e.id === id);
}

export function isPuterEngine(id: string): boolean {
  return id.startsWith("puter-");
}


/** Aliases para neural-nucleus-actions e painéis legados */
export type AiEngineDef = AiEngine & {
  kind?: 'lexis' | 'puter' | 'official';
  surfaces?: Array<'chat' | 'scan' | 'ba' | 'veredito' | 'all'>;
};

export const AI_ENGINES_CATALOG: AiEngineDef[] = AI_ENGINES.map((e) => ({
  ...e,
  kind:
    e.group === 'local'
      ? 'lexis'
      : e.group === 'puter'
        ? 'puter'
        : 'official',
  surfaces: ['all', 'chat', 'scan', 'ba', 'veredito'] as AiEngineDef['surfaces'],
}));

export function resolveOfficialKeysPresent(): Record<string, boolean> {
  return {
    xai: !!(process.env.XAI_API_KEY || process.env.XAI_GROK_PRESTIGE_API_KEY),
    'groq-llama': !!process.env.GROQ_API_KEY,
    gemini: !!process.env.GEMINI_API_KEY,
    claude: !!(process.env.ANTHROPIC_API_KEY || process.env.OMNIROUTE_API_KEY),
    omniroute: !!process.env.OMNIROUTE_API_KEY,
  };
}
