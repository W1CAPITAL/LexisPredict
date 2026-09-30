import { COGNITIVE_CAPABILITIES } from './registry';
import type { CapabilityId, CognitiveIntent, CognitivePlan, CognitivePlanStep } from './types';

const RULES: Array<{ intent: CognitiveIntent; patterns: RegExp[] }> = [
  { intent: 'document-ocr', patterns: [/ocr/i, /extrair texto/i, /imagem.*texto/i, /documento escaneado/i] },
  { intent: 'web-research', patterns: [/pesquisa web/i, /buscar na web/i, /scrap/i, /crawl/i, /firecrawl/i, /pesquisar site/i] },
  { intent: 'legal-research', patterns: [/pesquis/i, /jurisprud/i, /doutrina/i, /fonte/i, /precedente/i] },
  { intent: 'case-analysis', patterns: [/processo/i, /cnj/i, /djen/i, /datajud/i, /liminar/i, /senten[cç]a/i] },
  { intent: 'world-simulation', patterns: [/mundo procedural/i, /world sandbox/i, /sandbox/i, /minecraft/i, /voxel/i, /biomas?/i, /chunks?/i] },
  { intent: 'plugin-management', patterns: [/plugins?/i, /plugin hub/i, /conector(es)?/i, /toolkits?/i] },
  { intent: 'agent-orchestration', patterns: [/equipe de agentes/i, /agent studio/i, /multiagente/i, /multi-agent/i, /spawn.*agente/i] },
  { intent: 'simulation', patterns: [/simulad/i, /simular/i, /monte\s*carlo/i, /cen[aá]rios?/i, /probabilidade.*op[cç][aã]o/i] },
  { intent: 'video-generation', patterns: [/gerar v[ií]deo/i, /criar v[ií]deo/i, /image[- ]to[- ]video/i, /text[- ]to[- ]video/i] },
  { intent: 'image-generation', patterns: [/gerar imagem/i, /criar imagem/i, /text[- ]to[- ]image/i, /imagem por prompt/i] },
  { intent: 'api-discovery', patterns: [/api p[uú]blica/i, /public[- ]apis?/i, /descobrir api/i, /api gratuita/i] },
  { intent: 'skill-learning', patterns: [/build[- ]your[- ]own/i, /freecodecamp/i, /aprender.*c[oó]digo/i, /skill.*engenharia/i, /tutorial.*implement/i] },
  { intent: 'automation', patterns: [/automat/i, /cron/i, /rotina/i, /workflow/i] },
  { intent: 'web-monitor', patterns: [/monitor/i, /mudan[cç]a/i, /acompanhar site/i, /vigiar/i] },
  { intent: 'browser-task', patterns: [/navegador/i, /browser/i, /clicar/i, /preencher site/i] },
  { intent: 'presentation', patterns: [/ppt/i, /slides?/i, /apresenta[cç][aã]o/i] },
  { intent: 'report', patterns: [/relat[oó]rio/i, /dossi[eê]/i, /executivo/i] },
  { intent: 'voice', patterns: [/voz/i, /[aá]udio/i, /narra[cç][aã]o/i] },
  { intent: 'image-enhance', patterns: [/upscal/i, /melhorar imagem/i, /nitidez/i, /resolu[cç][aã]o/i] },
  { intent: 'visual-generation', patterns: [/anime/i, /render/i, /gerar imagem/i, /visual/i] },
  { intent: 'developer', patterns: [/c[oó]digo/i, /bug/i, /build/i, /typescript/i, /react/i, /next\.js/i] },
  { intent: 'knowledge', patterns: [/wiki/i, /conhecimento/i, /mem[oó]ria/i, /lembr/i] },
];

export function inferCognitiveIntent(text: string, hints?: { hasImage?: boolean; hasDocument?: boolean }): CognitiveIntent {
  if (hints?.hasDocument || hints?.hasImage) {
    if (/ocr|texto|extrair|ler/i.test(text)) return 'document-ocr';
  }
  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(text))) return rule.intent;
  }
  return 'chat';
}

function step(capability: CapabilityId, reason: string, required = true): CognitivePlanStep {
  return { capability, reason, required };
}

const INTENT_STEPS: Record<CognitiveIntent, CognitivePlanStep[]> = {
  chat: [
    step('memory-v2', 'Recuperar contexto útil sem gastar tokens.'),
    step('model-cascade', 'Gerar a resposta quando regra local não for suficiente.'),
    step('quality-gate', 'Validar a saída antes de entregar.'),
  ],
  'legal-research': [
    step('memory-v2', 'Reusar contexto e decisões existentes.'),
    step('research', 'Separar perguntas, fontes e evidências.'),
    step('firecrawl', 'Ampliar fontes web quando Firecrawl estiver configurado.', false),
    step('council', 'Revisar fatos, contrapontos e implicações.'),
    step('quality-gate', 'Bloquear afirmações sem suporte suficiente.'),
  ],
  'case-analysis': [
    step('lexis-rules', 'Aplicar regras de CNJ, carteira, permissões e dados primeiro.'),
    step('memory-v2', 'Trazer histórico relevante do caso.'),
    step('council', 'Analisar por lentes operacional, jurídica e crítica.'),
    step('quality-gate', 'Checar coerência e evidência.'),
  ],
  'world-simulation': [
    step('world-sandbox', 'Gerar mundo/chunks e executar agentes localmente.'),
    step('agent-studio', 'Selecionar papéis especializados quando houver múltiplos agentes.', false),
    step('quality-gate', 'Separar simulação criativa de fatos do mundo real.'),
  ],
  'plugin-management': [
    step('plugin-platform', 'Resolver capacidades por manifesto, permissões e configuração.'),
    step('quality-gate', 'Bloquear execução não registrada ou sem permissão.'),
  ],
  'agent-orchestration': [
    step('agent-studio', 'Planejar equipe, papéis, ferramentas e gates.'),
    step('memory-v2', 'Dar contexto útil sem duplicação.'),
    step('council', 'Revisar objetivos e conflitos entre agentes.', false),
    step('quality-gate', 'Exigir resultado verificável.'),
  ],
  'web-research': [
    step('memory-v2', 'Evitar repetir pesquisa já resolvida.'),
    step('firecrawl', 'Buscar e extrair conteúdo web estruturado quando configurado.', false),
    step('research', 'Organizar fontes, perguntas e evidências.'),
    step('quality-gate', 'Separar fonte, inferência e conclusão.'),
  ],
  simulation: [
    step('simulation-engine', 'Comparar cenários localmente antes de gastar modelo.'),
    step('council', 'Interpretar premissas e riscos do modelo.', false),
    step('quality-gate', 'Evitar tratar simulação como previsão garantida.'),
  ],
  'skill-learning': [
    step('skill-library', 'Selecionar material curado e prática deliberada.'),
    step('memory-v2', 'Conectar aprendizado ao contexto já conhecido.'),
    step('quality-gate', 'Exigir exercício, teste ou artefato verificável.'),
  ],
  'api-discovery': [
    step('api-discovery', 'Filtrar APIs por utilidade, autenticação e risco.'),
    step('research', 'Validar documentação e limites atuais.', false),
    step('quality-gate', 'Não integrar API sem contrato, termos e fallback.'),
  ],
  'image-generation': [
    step('comfy-media', 'Enfileirar workflow de imagem quando ComfyUI estiver configurado.', false),
    step('visual-render', 'Usar motor visual alternativo quando disponível.', false),
    step('image-enhance', 'Aplicar upscale apenas depois da geração.', false),
    step('quality-gate', 'Verificar aderência ao prompt e integridade visual.'),
  ],
  'video-generation': [
    step('comfy-media', 'Enfileirar workflow de vídeo quando ComfyUI estiver configurado.', false),
    step('visual-render', 'Usar pipeline de vídeo/render alternativo.', false),
    step('quality-gate', 'Validar duração, frames, texto e aderência ao pedido.'),
  ],
  'document-ocr': [
    step('ocr', 'Extrair texto com motor local/self-host e fallback.'),
    step('document-understanding', 'Estruturar conteúdo sem misturar extração e interpretação.'),
    step('quality-gate', 'Sinalizar baixa confiança ou campos ausentes.'),
  ],
  automation: [
    step('lexis-rules', 'Resolver a maior parte da automação por regra determinística.'),
    step('observability', 'Registrar execução e falhas.'),
    step('model-cascade', 'Usar IA apenas na parte sem regra estável.', false),
  ],
  'web-monitor': [
    step('change-watch', 'Gerar snapshots e diffs antes de interpretar mudanças.'),
    step('firecrawl', 'Extrair a versão atual da fonte quando configurado.', false),
    step('research', 'Interpretar somente mudanças relevantes.', false),
    step('observability', 'Registrar quando e por que houve alerta.'),
  ],
  'browser-task': [
    step('browser-agent', 'Executar navegação em ambiente isolado e observável.'),
    step('quality-gate', 'Confirmar resultado em vez de confiar só no clique.'),
  ],
  report: [
    step('memory-v2', 'Reusar dados e contexto já conhecidos.'),
    step('report-engine', 'Montar narrativa e seções estruturadas.'),
    step('council', 'Revisar achados e contrapontos.', false),
    step('quality-gate', 'Checar números, fontes e lacunas.'),
  ],
  presentation: [
    step('report-engine', 'Estruturar fatos e mensagem antes do layout.'),
    step('presentation-engine', 'Converter narrativa em slides.'),
    step('quality-gate', 'Checar consistência entre dados e slides.'),
  ],
  voice: [
    step('voice-studio', 'Usar worker de voz apenas quando configurado.', false),
    step('quality-gate', 'Validar texto/roteiro antes da síntese.'),
  ],
  'image-enhance': [
    step('image-enhance', 'Executar upscale fora do bundle principal.', false),
    step('quality-gate', 'Confirmar que o conteúdo não foi alterado indevidamente.'),
  ],
  'visual-generation': [
    step('visual-render', 'Usar render/estilização em worker dedicado.', false),
    step('quality-gate', 'Verificar aderência ao pedido.'),
  ],
  developer: [
    step('memory-v2', 'Recuperar decisões técnicas anteriores.'),
    step('council', 'Planejar, revisar riscos e testar mudança.'),
    step('quality-gate', 'Exigir evidência de teste/build antes de concluir.'),
  ],
  knowledge: [
    step('memory-v2', 'Recuperar e deduplicar conhecimento existente.'),
    step('research', 'Expandir conhecimento quando necessário.', false),
    step('quality-gate', 'Separar memória, inferência e evidência.'),
  ],
};

export function buildCognitivePlan(input: {
  text: string;
  hasImage?: boolean;
  hasDocument?: boolean;
}): CognitivePlan {
  const intent = inferCognitiveIntent(input.text, input);
  const steps = INTENT_STEPS[intent].filter((s) => Boolean(COGNITIVE_CAPABILITIES[s.capability]));
  return {
    intent,
    steps,
    zeroTokenFirst: steps.length > 0 && COGNITIVE_CAPABILITIES[steps[0].capability].zeroToken,
    requiresModel: steps.some((s) => s.required && !COGNITIVE_CAPABILITIES[s.capability].zeroToken),
  };
}
