/**
 * Classificador neural DataJud/DJEN — Claude via OmniRoute/OpenRouter prioritário.
 */
import { runCascade } from '@/lib/ai/cascade';
import type { EventoTipo } from '@/lib/case-logic';

export type AiCaseClassification = {
  evento_tipo: EventoTipo | string;
  evento_resumo: string;
  severidade: 'critica' | 'alta' | 'media' | 'baixa' | 'positiva' | 'info';
  alertar: boolean;
  motivo_alerta: string | null;
  flags: {
    encerrado: boolean;
    cumprimento_sentenca: boolean;
    procedente: boolean;
    improcedente: boolean;
    parcial: boolean;
    liminar: boolean;
    busca_apreensao: boolean;
    ba_tipo: 'VEICULO' | 'PRISAO' | 'PENHORA_BENS' | 'IMOVEL' | 'GENERICO' | null;
    cancelamento_distribuicao: boolean;
    novo_relevante: boolean;
    audiencia: boolean;
    custas: boolean;
  };
  engine: string;
  raw?: string;
};

const SYSTEM = `Você classifica andamentos processuais brasileiros (DataJud + DJEN).

FLAGS OBRIGATÓRIAS (boolean):
- procedente / improcedente / parcial (sentença ou acórdão de mérito)
- cumprimento_sentenca
- encerrado (trânsito, baixa definitiva, extinção)
- liminar
- audiencia
- custas (guia/taxa/UFESP a recolher — não confunda com renda)
- busca_apreensao: true SÓ com mandado/ordem de BA de bem ou prisão efetivos
- ba_tipo: VEICULO | PRISAO | PENHORA_BENS | IMOVEL | GENERICO | null
- cancelamento_distribuicao (art. 290 etc.)
- novo_relevante

NÃO marque BA por: ementa de terceiro, jurisprudência citada, só nome da classe "ação de busca e apreensão".

evento_tipo um de:
ba|sentenca_procedente|sentenca_improcedente|sentenca_parcial|cumprimento_sentenca|transito_ou_baixa|cancelamento_distribuicao|liminar|audiencia|custas|novo_andamento_relevante|rotina

Responda APENAS JSON:
{"evento_tipo":"...","evento_resumo":"frase curta","severidade":"critica|alta|media|baixa|positiva|info","alertar":true/false,"motivo_alerta":null,"flags":{"encerrado":false,"cumprimento_sentenca":false,"procedente":false,"improcedente":false,"parcial":false,"liminar":false,"busca_apreensao":false,"ba_tipo":null,"cancelamento_distribuicao":false,"novo_relevante":false,"audiencia":false,"custas":false}}`;

function compactMovs(movimentos: any[], max = 14): string {
  return (movimentos || [])
    .slice(0, max)
    .map((m) => {
      const d = m.dataHora || m.data || '';
      const n = m.nome || m.descricao || m.texto || '';
      return `- ${d} ${String(n).slice(0, 240)}`;
    })
    .join('\n');
}

function compactDjen(comunicacoes: any[], max = 10): string {
  return (comunicacoes || [])
    .slice(0, max)
    .map((c) => {
      const d = c.data_disponibilizacao || c.data || '';
      const t = c.texto || c.conteudo || '';
      return `- ${d} ${String(t).slice(0, 320)}`;
    })
    .join('\n');
}

function parseJson(text: string): any | null {
  try {
    const clean = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const a = clean.indexOf('{');
    const b = clean.lastIndexOf('}');
    if (a < 0 || b <= a) return null;
    return JSON.parse(clean.slice(a, b + 1));
  } catch {
    return null;
  }
}

const DEFAULT_FLAGS: AiCaseClassification['flags'] = {
  encerrado: false,
  cumprimento_sentenca: false,
  procedente: false,
  improcedente: false,
  parcial: false,
  liminar: false,
  busca_apreensao: false,
  ba_tipo: null,
  cancelamento_distribuicao: false,
  novo_relevante: false,
  audiencia: false,
  custas: false,
};

export async function classifyCaseEventsWithAi(input: {
  protocolo: string;
  cliente?: string;
  movimentos?: any[];
  comunicacoes?: any[];
  preferred?: string;
}): Promise<AiCaseClassification | null> {
  const movTxt = compactMovs(input.movimentos || []);
  const djenTxt = compactDjen(input.comunicacoes || []);
  if (!movTxt && !djenTxt) return null;

  const user = `Protocolo: ${input.protocolo}
Cliente: ${input.cliente || '—'}
DATAJUD:
${movTxt || '(vazio)'}
DJEN:
${djenTxt || '(vazio)'}
Classifique com flags precisas.`;

  try {
    // Preferência: Claude → OmniRoute → OpenRouter → demais (cascade)
    const pref =
      input.preferred ||
      process.env.SCAN_AI_PREFERRED ||
      'claude';

    const r = await runCascade({
      preferred: pref,
      forceEngineId:
        pref === 'auto' || pref === 'puter' ? undefined : pref,
      surface: 'scan',
      system: SYSTEM,
      messages: [{ role: 'user', content: user }],
      temperature: 0.05,
      max_tokens: 800,
    });

    const j = parseJson(r.text);
    if (!j || !j.evento_tipo) return null;

    const flags = { ...DEFAULT_FLAGS, ...(j.flags || {}) };
    if (flags.busca_apreensao && !flags.ba_tipo) flags.ba_tipo = 'GENERICO';
    if (flags.busca_apreensao) j.evento_tipo = 'ba';
    if (flags.procedente && !flags.improcedente && !flags.parcial)
      j.evento_tipo = j.evento_tipo || 'sentenca_procedente';
    if (flags.improcedente && !flags.procedente)
      j.evento_tipo = j.evento_tipo || 'sentenca_improcedente';

    return {
      evento_tipo: String(j.evento_tipo || 'rotina'),
      evento_resumo: String(j.evento_resumo || '').slice(0, 400),
      severidade: j.severidade || 'info',
      alertar: !!j.alertar,
      motivo_alerta: j.motivo_alerta
        ? String(j.motivo_alerta).slice(0, 300)
        : null,
      flags,
      engine: `${r.engineId}:${r.model}`,
      raw: r.text.slice(0, 1000),
    };
  } catch (e) {
    console.error('[classifyCaseEventsWithAi]', (e as any)?.message || e);
    return null;
  }
}
