/**
 * Classificador neural — SEM 'use server' no arquivo inteiro
 * (funções síncronas não podem ser Server Actions).
 * classifyCaseEventsWithAi é async e chamada só de server modules.
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
    cancelamento_distribuicao: boolean;
    novo_relevante: boolean;
  };
  engine: string;
  raw?: string;
};

const SYSTEM = `Você classifica andamentos processuais brasileiros (DataJud/DJEN).

REGRA CRÍTICA — busca_apreensao=true SOMENTE se houver:
- mandado/ordem de busca e apreensão DE BEM (veículo, etc.) no processo da parte; ou
- cumprimento de liminar/mandado de apreensão efetivamente deferido contra o bem do cliente.
NÃO marque BA se a menção for: jurisprudência citada, exemplo, ementa de outro caso, "ação de busca e apreensão" só no nome da classe de processo alheio, ou fundamentação doutrinária. Menção incidental = busca_apreensao false.
Responda APENAS JSON:
{"evento_tipo":"ba|sentenca_procedente|sentenca_improcedente|sentenca_parcial|cumprimento_sentenca|transito_ou_baixa|cancelamento_distribuicao|liminar|novo_andamento_relevante|rotina","evento_resumo":"...","severidade":"critica|alta|media|baixa|positiva|info","alertar":true/false,"motivo_alerta":null,"flags":{"encerrado":false,"cumprimento_sentenca":false,"procedente":false,"improcedente":false,"parcial":false,"liminar":false,"busca_apreensao":false,"cancelamento_distribuicao":false,"novo_relevante":false}}`;

function compactMovs(movimentos: any[], max = 12): string {
  return (movimentos || [])
    .slice(0, max)
    .map((m) => {
      const d = m.dataHora || m.data || '';
      const n = m.nome || m.descricao || m.texto || '';
      return `- ${d} ${String(n).slice(0, 220)}`;
    })
    .join('\n');
}

function compactDjen(comunicacoes: any[], max = 8): string {
  return (comunicacoes || [])
    .slice(0, max)
    .map((c) => {
      const d = c.data_disponibilizacao || c.data || '';
      const t = c.texto || c.conteudo || '';
      return `- ${d} ${String(t).slice(0, 280)}`;
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

const DEFAULT_FLAGS = {
  encerrado: false,
  cumprimento_sentenca: false,
  procedente: false,
  improcedente: false,
  parcial: false,
  liminar: false,
  busca_apreensao: false,
  cancelamento_distribuicao: false,
  novo_relevante: false,
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
DATAJUD:\n${movTxt || '(vazio)'}
DJEN:\n${djenTxt || '(vazio)'}
Classifique.`;

  try {
    const pref = input.preferred || process.env.SCAN_AI_PREFERRED || 'groq';
    const r = await runCascade({
      preferred: pref,
      forceEngineId: pref === 'auto' ? undefined : pref,
      surface: 'scan',
      system: SYSTEM,
      messages: [{ role: 'user', content: user }],
      temperature: 0.1,
      max_tokens: 700,
    });
    const j = parseJson(r.text);
    if (!j || !j.evento_tipo) return null;
    const flags = { ...DEFAULT_FLAGS, ...(j.flags || {}) };
    if (flags.busca_apreensao) j.evento_tipo = 'ba';
    return {
      evento_tipo: String(j.evento_tipo || 'rotina'),
      evento_resumo: String(j.evento_resumo || '').slice(0, 400),
      severidade: j.severidade || 'info',
      alertar: !!j.alertar,
      motivo_alerta: j.motivo_alerta ? String(j.motivo_alerta).slice(0, 300) : null,
      flags,
      engine: `${r.engineId}:${r.model}`,
      raw: r.text.slice(0, 1000),
    };
  } catch (e) {
    console.error('[classifyCaseEventsWithAi]', (e as any)?.message || e);
    return null;
  }
}

/** Pura — NÃO exportar como Server Action */
