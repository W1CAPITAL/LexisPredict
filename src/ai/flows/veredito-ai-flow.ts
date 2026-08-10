/**
 * Veredito AI — parecer operacional no nível do "sugerir resposta".
 * Motor determinístico forte + IA opcional (não genérico).
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */
'use server';

import { ai, z } from '@/ai/genkit';
import { fetchDataJud } from '@/lib/datajud';
import { detectarAudienciaPendente } from '@/lib/audiencia-detect';

const API_KEYS = {
  ANTHROPIC: process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY,
  XAI: process.env.XAI_API_KEY || process.env.XAI_GROK_PRESTIGE_API_KEY,
  GROQ: process.env.GROQ_API_KEY,
};

const XAI_MODEL = process.env.XAI_MODEL || 'grok-2-1212';

const SYSTEM_INSTRUCTIONS = `Você é o Veredito operacional do LexisPredict (gabinete de revisão bancária).
NÃO invente resultado de mérito. NÃO diga só "em andamento" se houver sinal concreto.

REGRAS:
1. Classifique o que HÁ nos movimentos/DJEN: baixa/trânsito, procedente/improcedente/parcial, custas/guia gerada, audiência SÓ se designada, BA/penhora, cumprimento, gratuidade, redistribuição.
2. Mensagem ao cliente: português leigo, tom calmo, sem nome de escritório, sem prometer dinheiro/resultado. Estilo "sugerir resposta".
3. Risco: o que a equipe deve fazer AGORA (contato, conferir guia, validar BA no CNJ, etc.).
4. Se só houver petições/conclusões sem mérito, diga isso com clareza e aponte o último ato útil.

JSON OBRIGATÓRIO:
{
  "resumoTecnico": "2-5 frases + sinais detectados",
  "analiseRisco": "riscos operacionais concretos",
  "proximosPassos": "lista numerada para o operador",
  "mensagemCliente": "texto pronto para WhatsApp, leigo",
  "conclusaoEncerramento": "encerrado ou não e por quê",
  "sinais": ["custas","baixa","procedente", ...]
}`;

const VereditoInputSchema = z.object({
  cnj: z.string(),
  preferredModel: z.string().optional(),
  /** Textos DJEN opcionais da timeline server */
  djenTexts: z.array(z.string()).optional(),
});

const VereditoOutputSchema = z.object({
  resumoTecnico: z.string(),
  analiseRisco: z.string(),
  proximosPassos: z.string(),
  mensagemCliente: z.string(),
  conclusaoEncerramento: z.string().optional(),
  sinais: z.array(z.string()).optional(),
  success: z.boolean(),
  dataJudRaw: z.any().optional(),
  error: z.boolean().optional(),
  message: z.string().optional(),
  isDeterministic: z.boolean().optional(),
  engineUsed: z.string().optional(),
});

function cleanJsonResponse(text: string): any {
  if (!text) return null;
  try {
    let clean = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const firstBrace = clean.indexOf('{');
    const lastBrace = lastIndex(clean, '}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      const parsed = JSON.parse(clean.substring(firstBrace, lastBrace + 1));
      if (parsed.resumoTecnico) return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function lastIndex(s: string, ch: string) {
  return s.lastIndexOf(ch);
}

function fmtData(iso?: string | null) {
  if (!iso) return 'S/D';
  try {
    return new Date(iso).toLocaleDateString('pt-BR');
  } catch {
    return String(iso).slice(0, 10);
  }
}

type SinalBag = {
  sinais: string[];
  merito: string;
  risco: string[];
  passos: string[];
  cliente: string;
  conclusao: string;
  ultimoUtil: string;
};

/**
 * Classificação operacional — espelha a lógica do sugerir resposta.
 */
function classificarSinais(textoFull: string, movs: any[]): SinalBag {
  const U = (textoFull || '').toUpperCase();
  const sinais: string[] = [];
  const risco: string[] = [];
  const passos: string[] = [];

  const temBaixa =
    /BAIXA\s+DEFINITIVA|TR[AÂ]NSITO\s+EM\s+JULGADO|ARQUIVAMENTO\s+DEFINITIVO|EXTIN[CÇ][AÃ]O\s+DO\s+PROCESSO/.test(
      U
    );
  const temCancelamento =
    /CANCELAMENTO\s+DA\s+DISTRIBUI[CÇ][AÃ]O|ART\.?\s*290|INDEFERIMENTO\s+DA\s+PETI[CÇ][AÃ]O\s+INICIAL/.test(
      U
    );
  const temImproc =
    /\bIMPROCEDENTE\b|IMPROCED[EÊ]NCIA|NEGADO\s+PROVIMENTO|RECURSO\s+DESPROVIDO/.test(U);
  const temParcial =
    /PARCIALMENTE\s+PROCEDENTE|PROCED[EÊ]NCIA\s+PARCIAL|PROCEDENTE\s+EM\s+PARTE/.test(U);
  const temProc =
    !temImproc &&
    !temParcial &&
    /\bJULGO\s+PROCEDENTE\b|\bJULGADA?\s+PROCEDENTE\b|\bPEDIDO\s+PROCEDENTE\b/.test(U);
  const temCustas =
    /GUIA\s+GERADA|JUNTADA\s*[-–]?\s*GUIA|CUSTAS|PREPARO|TAXA\s+JUDICI|UFESP|DESERTO|FALTA\s+DE\s+PREPARO|RECOLHER\s+AS\s+CUSTAS/.test(
      U
    );
  const temCustasPagas =
    /CUSTAS\s+PAGAS|GUIA\s+PAGA|COMPROVANTE\s+DE\s+PAGAMENTO\s+DE\s+CUSTAS|CERTID[AÃ]O\s+DE\s+PAGAMENTO/.test(
      U
    );
  const temHonor =
    /MAJORA[CÇ][AÃ]O\s+DE\s+HONOR|HONOR[AÁ]RIOS.{0,30}15\s*%|SUCUMB[EÊ]NCIA/.test(U);
  const temBA =
    /BUSCA\s+E\s+APREENS[AÃ]O|MANDADO\s+DE\s+BUSCA|APREENS[AÃ]O\s+DO\s+VE[IÍ]CULO|REINTEGRA[CÇ][AÃ]O\s+DE\s+POSSE/.test(
      U
    );
  const temPenhora = /PENHORA\s+DE\s+BENS|PENHORA\s+ON[- ]LINE|BLOQUEIO\s+DE\s+VALORES/.test(U);
  const temCumprimento =
    /CUMPRIMENTO\s+DE\s+SENTEN[CÇ]A|FASE\s+DE\s+EXECU[CÇ][AÃ]O|INICIOU-?SE\s+O\s+CUMPRIMENTO/.test(
      U
    );
  const temGratuidade =
    /GRATUIDADE\s+DA\s+JUSTI[CÇ]A|JUSTI[CÇ]A\s+GRATUITA\s+(DEFERIDA|CONCEDIDA)|AJG\s+DEFERIDA/.test(
      U
    );
  const temRedistrib = /REDISTRIBUI[CÇ][AÃ]O/.test(U);

  const aud = detectarAudienciaPendente(U);
  const temAudiencia = aud.isAudienciaPendente;

  if (temBA) sinais.push('busca_apreensao');
  if (temPenhora) sinais.push('penhora');
  if (temBaixa) sinais.push('baixa_transito');
  if (temCancelamento) sinais.push('cancelamento_distribuicao');
  if (temImproc) sinais.push('improcedente');
  if (temProc) sinais.push('procedente');
  if (temParcial) sinais.push('parcial');
  if (temCustas && !temCustasPagas) sinais.push('custas_pendentes');
  if (temCustasPagas) sinais.push('custas_pagas');
  if (temHonor) sinais.push('honorarios');
  if (temCumprimento) sinais.push('cumprimento');
  if (temAudiencia) sinais.push('audiencia_designada');
  if (temGratuidade) sinais.push('gratuidade');
  if (temRedistrib) sinais.push('redistribuicao');

  // Último movimento "útil" (não mero decurso genérico se houver melhor)
  const sorted = [...movs].sort(
    (a, b) =>
      new Date(b.dataHora || 0).getTime() - new Date(a.dataHora || 0).getTime()
  );
  const util =
    sorted.find((m) =>
      /SENTEN|AC[OÓ]RD|BAIXA|TR[AÂ]NSITO|CUSTAS|GUIA|AUDI[EÊ]NCIA|CUMPRIMENTO|BUSCA|PENHORA|PROCEDENTE|IMPROCEDENTE|GRATUIDADE|REDISTRIB/i.test(
        `${m.nome || ''} ${m.complemento || ''}`
      )
    ) || sorted[0];
  const ultimoUtil = util
    ? `${fmtData(util.dataHora)} — ${util.nome || 'Movimento'}${
        util.complemento ? `: ${String(util.complemento).slice(0, 120)}` : ''
      }`
    : 'Sem movimentos legíveis.';

  let merito = 'Sem sentença de mérito clara nos textos analisados.';
  if (temParcial) merito = 'Indício de desfecho PARCIALMENTE PROCEDENTE.';
  else if (temImproc)
    merito = 'Indício de desfecho IMPROCEDENTE / recurso desprovido.';
  else if (temProc) merito = 'Indício de desfecho PROCEDENTE.';
  else if (temCancelamento)
    merito =
      'Há sinal de cancelamento/extinção por vício formal (ex.: art. 290 / petição inicial) — não é julgamento do mérito bancário.';
  else if (temCumprimento)
    merito = 'Processo em fase de cumprimento de sentença / execução.';
  else if (temBaixa)
    merito =
      'Há baixa ou trânsito, mas o teor do mérito não está explícito nos últimos movimentos — validar no PJe.';

  if (temBA) {
    risco.push(
      'Indício de busca e apreensão no texto — validar se o mandado é DESTE CNJ antes de alarmar o cliente.'
    );
    passos.push('Confirmar vínculo do mandado com este protocolo e UF.');
  }
  if (temPenhora) {
    risco.push('Menção a penhora/bloqueio — conferir se atinge o cliente desta ação.');
    passos.push('Checar extrato de penhora no tribunal.');
  }
  if (temCustas && !temCustasPagas) {
    risco.push(
      'Custas/guia/preparo mencionados — risco de ônus ou deserção se não recolhido.'
    );
    passos.push('Conferir se a guia é do autor ou do réu e se já foi paga.');
  }
  if (temHonor) {
    risco.push('Possível sucumbência/majoração de honorários — passivo financeiro.');
  }
  if (temAudiencia) {
    risco.push(`Audiência designada (${aud.resumo}).`);
    passos.push('Anotar data da audiência e avisar o cliente com orientação clara.');
  }
  if (temBaixa || temCancelamento) {
    passos.push('Confirmar trânsito/baixa no sistema do tribunal e status interno no CRM.');
  }
  if (temCumprimento) {
    passos.push('Verificar fase de cumprimento e eventuais intimações ao executado.');
  }
  if (!passos.length) {
    passos.push('Conferir autos no PJe/eproc para o teor completo do último ato útil.');
    passos.push('Registrar retorno no gabinete após leitura.');
  }

  // Mensagem cliente (leiga, protetiva)
  let cliente = '';
  if (temBA) {
    cliente = `Olá! Identificamos uma movimentação sensível no processo (possível medida de busca/apreensão). Nossa equipe está conferindo se isso se refere ao seu caso e em breve retorna com orientação segura. Por enquanto, aguarde nosso contato.`;
  } else if (temAudiencia) {
    cliente = `Olá! Há indício de audiência designada no seu processo. Estamos confirmando data e local nos autos oficiais e já te orientamos sobre o que fazer. Você não precisa se deslocar até nossa confirmação.`;
  } else if (temCustas && !temCustasPagas) {
    cliente = `Olá! Apareceu movimentação ligada a taxa/custas no tribunal. Estamos verificando se há guia a pagar e de quem é a responsabilidade, para não gerar cobrança indevida. Em breve te atualizamos.`;
  } else if (temImproc && temBaixa) {
    cliente = `Olá! O tribunal registra baixa/trânsito com histórico desfavorável no mérito. Estamos validando o teor completo e eventuais custas finais antes de qualquer orientação definitiva.`;
  } else if (temProc && temBaixa) {
    cliente = `Olá! Há indício de desfecho favorável com baixa/trânsito. Confirmamos nos autos oficiais o que isso significa na prática (valores, cumprimento, próximos passos) e te retornamos com clareza.`;
  } else if (temCumprimento) {
    cliente = `Olá! Seu processo avançou para a fase de cumprimento de sentença. Isso significa que a decisão já existe e agora se discute o cumprimento. Nossa equipe analisa o andamento e te explica o próximo passo em linguagem simples.`;
  } else if (temCancelamento) {
    cliente = `Olá! Há registro de encerramento formal do processo (não necessariamente julgamento do pedido principal). Estamos confirmando o motivo e se cabe nova medida. Já te retornamos.`;
  } else if (temBaixa) {
    cliente = `Olá! O tribunal aponta baixa ou trânsito em julgado. Estamos confirmando o desfecho exato nos autos para te orientar com segurança — sem promessas precipitadas.`;
  } else {
    cliente = `Olá! Consultamos o andamento do seu processo. O último ato relevante que vimos foi: ${ultimoUtil}. Continuamos monitorando e, se surgir decisão, audiência, custas ou qualquer medida urgente, te avisamos com orientação clara.`;
  }

  let conclusao = 'Sem encerramento confirmado nos textos analisados.';
  if (temBaixa || temCancelamento) {
    conclusao = temImproc
      ? 'Baixa/trânsito com histórico de improcedência — provável desfecho desfavorável (validar no PJe).'
      : temProc
        ? 'Baixa/trânsito com histórico de procedência — validar êxito efetivo e cumprimento.'
        : temCancelamento
          ? 'Extinção/cancelamento formal — não confundir com vitória ou derrota de mérito.'
          : 'Baixa ou trânsito detectado — confirmar teor no tribunal.';
  }

  if (!risco.length) {
    risco.push(
      'Sem alerta crítico automático. Ainda assim, DataJud/DJEN podem atrasar — casos urgentes exigem PJe.'
    );
  }

  return {
    sinais,
    merito,
    risco,
    passos,
    cliente,
    conclusao,
    ultimoUtil,
  };
}

/** Parecer determinístico rico — funciona sem API key. */
function analisarDeterministico(
  dataJudData: any,
  djenTexts: string[] = []
) {
  const movs = Array.isArray(dataJudData?.movimentos)
    ? [...dataJudData.movimentos]
    : [];
  movs.sort(
    (a: any, b: any) =>
      new Date(b.dataHora || 0).getTime() - new Date(a.dataHora || 0).getTime()
  );

  const textoMovs = movs
    .slice(0, 50)
    .map(
      (m: any) =>
        `${m.nome || ''} ${m.complemento || ''} ${m.descricao || ''}`
    )
    .join(' || ');
  const textoDjen = (djenTexts || []).join(' || ');
  const texto = `${textoMovs} || ${textoDjen}`.toUpperCase();

  const classe = String(
    dataJudData?.classe || dataJudData?.classeProcessual || ''
  ).toUpperCase();
  const c = classificarSinais(texto, movs);

  const ultimos = movs
    .slice(0, 10)
    .map((m: any) => {
      const d = fmtData(m.dataHora);
      return `· ${d}: ${m.nome || 'Movimento'}${
        m.complemento ? ' — ' + String(m.complemento).slice(0, 100) : ''
      }`;
    })
    .join('\n');

  const sinaisLinha = c.sinais.length
    ? c.sinais.map((s) => s.replace(/_/g, ' ')).join(', ')
    : 'nenhum sinal crítico automático';

  const resumoTecnico = [
    `Classe: ${classe || 'N/D'} · Grau: ${dataJudData?.grau || 'N/D'}`,
    `Órgão: ${dataJudData?.orgaoJulgador || 'N/D'}`,
    `Polo ativo: ${(dataJudData?.poloAtivo || []).join('; ') || 'N/D'}`,
    `Polo passivo: ${(dataJudData?.poloPassivo || []).join('; ') || 'N/D'}`,
    '',
    `Leitura operacional: ${c.merito}`,
    `Último ato útil: ${c.ultimoUtil}`,
    `Sinais: ${sinaisLinha}`,
    '',
    'Cronologia recente:',
    ultimos || 'Sem movimentos.',
  ].join('\n');

  return {
    resumoTecnico,
    analiseRisco: c.risco.join(' '),
    proximosPassos: c.passos.map((p, i) => `${i + 1}) ${p}`).join('\n'),
    mensagemCliente: c.cliente,
    conclusaoEncerramento: c.conclusao,
    sinais: c.sinais,
    success: true,
    isDeterministic: true,
    engineUsed: 'local-operacional',
    dataJudRaw: dataJudData,
  };
}

async function callEngineWithRetry(
  url: string,
  key: string | undefined,
  model: string,
  context: string
) {
  if (!key) return null;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_INSTRUCTIONS },
          {
            role: 'user',
            content: `DADOS DO PROCESSO (DATAJUD + DJEN):\n${context}`,
          },
        ],
        temperature: 0.15,
      }),
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    return content ? cleanJsonResponse(content) : null;
  } catch {
    return null;
  }
}

export const vereditoAIFlow = ai.defineFlow(
  {
    name: 'vereditoAIFlow',
    inputSchema: VereditoInputSchema,
    outputSchema: VereditoOutputSchema,
  },
  async (input) => {
    const { cnj, preferredModel = 'xai', djenTexts = [] } = input;

    const dataJudData = await fetchDataJud(cnj);

    if (!dataJudData || dataJudData.error) {
      return {
        resumoTecnico: 'Não localizado no DataJud.',
        analiseRisco: 'Sem base CNJ — use nome/CNJ alternativo ou PJe.',
        proximosPassos: '1) Conferir dígitos do CNJ.\n2) Consultar PJe/eproc.\n3) Tentar DJEN por nome da parte.',
        mensagemCliente:
          'Olá! Ainda não localizamos o andamento completo na base pública. Vamos conferir no sistema do tribunal e te atualizamos.',
        success: false,
        error: true,
        message: dataJudData?.message || 'Erro de rede.',
        dataJudRaw: dataJudData,
        sinais: [],
      };
    }

    const baseDet = analisarDeterministico(dataJudData, djenTexts);

    // Sem chave: determinístico completo (já no nível sugerir resposta)
    if (!API_KEYS.XAI && !API_KEYS.GROQ && !API_KEYS.ANTHROPIC) {
      return baseDet;
    }

    const movementsContext = (dataJudData.movimentos || [])
      .sort(
        (a: any, b: any) =>
          new Date(b.dataHora || 0).getTime() -
          new Date(a.dataHora || 0).getTime()
      )
      .slice(0, 35)
      .map(
        (m: any) =>
          `- ${m.dataHora ? new Date(m.dataHora).toLocaleDateString('pt-BR') : 'S/D'}: ${m.nome} | ${m.complemento || ''}`
      )
      .join('\n');

    const djenBlock = (djenTexts || [])
      .slice(0, 8)
      .map((t, i) => `DJEN${i + 1}: ${String(t).slice(0, 400)}`)
      .join('\n');

    const compactContext = `
NÚMERO: ${dataJudData.numeroProcesso}
CLASSE: ${dataJudData.classe}
GRAU: ${dataJudData.grau || 'N/D'}
ÓRGÃO: ${dataJudData.orgaoJulgador || 'N/D'}
POLO ATIVO: ${(dataJudData.poloAtivo || []).join('; ') || 'N/D'}
POLO PASSIVO: ${(dataJudData.poloPassivo || []).join('; ') || 'N/D'}
SINAIS_MOTOR_LOCAL: ${(baseDet.sinais || []).join(', ') || 'nenhum'}
LEITURA_LOCAL: ${baseDet.resumoTecnico?.slice(0, 800)}
CRONOLOGIA:
${movementsContext}
${djenBlock ? `\nPUBLICAÇÕES DJEN:\n${djenBlock}` : ''}
`.trim();

    const engines = [
      {
        id: 'claude',
        url: 'https://api.anthropic.com/v1/messages',
        key: API_KEYS.ANTHROPIC,
        model:
          process.env.ANTHROPIC_MODEL ||
          process.env.CLAUDE_MODEL ||
          'claude-sonnet-4-20250514',
        kind: 'anthropic' as const,
      },
      {
        id: 'xai',
        url: 'https://api.x.ai/v1/chat/completions',
        key: API_KEYS.XAI,
        model: XAI_MODEL,
      },
      {
        id: 'groq',
        url: 'https://api.groq.com/openai/v1/chat/completions',
        key: API_KEYS.GROQ,
        model: 'llama-3.3-70b-versatile',
      },
    ];

    const prioritized = [...engines];
    const idx = prioritized.findIndex((e) => e.id === preferredModel);
    if (idx > -1) {
      const [fav] = prioritized.splice(idx, 1);
      prioritized.unshift(fav);
    }

    for (const engine of prioritized) {
      if (!engine.key) continue;
      let result: any = null;
      if (engine.id === 'claude' || (engine as any).kind === 'anthropic') {
        try {
          const { callOpenAICompatible } = await import('@/lib/ai/cascade');
          const r = await callOpenAICompatible(
            {
              id: 'claude',
              url: engine.url,
              key: engine.key || undefined,
              model: engine.model,
              kind: 'anthropic',
            },
            [
              { role: 'system', content: SYSTEM_INSTRUCTIONS },
              { role: 'user', content: compactContext },
            ],
            { temperature: 0.2, max_tokens: 4096 }
          );
          result = cleanJsonResponse(r.text);
        } catch {
          result = null;
        }
      } else {
        result = await callEngineWithRetry(
          engine.url,
          engine.key,
          engine.model,
          compactContext
        );
      }
      if (result?.resumoTecnico) {
        // Mescla sinais locais se a IA omitir
        const sinais = Array.from(
          new Set([
            ...(baseDet.sinais || []),
            ...((result.sinais as string[]) || []),
          ])
        );
        return {
          ...result,
          mensagemCliente:
            result.mensagemCliente || baseDet.mensagemCliente,
          analiseRisco: result.analiseRisco || baseDet.analiseRisco,
          proximosPassos: result.proximosPassos || baseDet.proximosPassos,
          sinais,
          success: true,
          error: false,
          dataJudRaw: dataJudData,
          isDeterministic: false,
          engineUsed: engine.id.toUpperCase(),
        };
      }
    }

    return baseDet;
  }
);

export async function executarVereditoAI(input: any) {
  return await vereditoAIFlow(input);
}
