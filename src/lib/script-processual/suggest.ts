/**
 * Motor de sugestão de mensagem ao cliente v12.0
 * — Linguagem leiga, direta, protetiva do escritório
 * — Adapta o texto ao que realmente consta no DataJud/DJEN
 * — Não inventa resultado; não promete dinheiro na conta
 * — Não cita nome comercial da empresa na mensagem
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import { parseISO, parse, isValid, format } from 'date-fns';
import { SCRIPT_CATALOG, ScriptTemplate } from './catalog';

export interface ScriptSuggestion {
  categoria: string;
  titulo: string;
  texto: string;
  quandoUsar: string;
}

export interface ScriptInput {
  clienteNome?: string;
  protocolo: string;
  ultimoRetorno?: string | null;
  movimentos?: Array<{
    nome?: string;
    complemento?: string;
    descricao?: string;
    dataHora?: string;
  }>;
  evento_tipo?: string | null;
  eventoTipo?: string | null;
  evento_resumo?: string | null;
  eventoResumo?: string | null;
  djen_ultimo_resumo?: string | null;
  djenTexts?: string[];
  tem_novo_andamento?: boolean;
  tem_atualizacao_pos_retorno?: boolean;
  djen_nova_comunicacao?: boolean;
  datajud_encerrado_tribunal?: boolean;
  em_cumprimento_sentenca?: boolean;
  indicio_busca_apreensao?: boolean;
  busca_apreensao?: boolean;
}

function firstName(full?: string): string {
  const n = (full || 'Cliente').trim().split(/\s+/)[0];
  return n || 'Cliente';
}

function fmtDate(raw?: string | null): string {
  if (!raw) return '';
  try {
    const clean = raw.trim();
    const d = clean.includes('/')
      ? parse(clean, 'dd/MM/yyyy', new Date())
      : parseISO(clean);
    if (isValid(d)) return format(d, 'dd/MM/yyyy');
  } catch {
    //
  }
  return '';
}

function buildCorpus(input: ScriptInput): string {
  const parts: string[] = [
    input.evento_resumo || '',
    input.eventoResumo || '',
    input.djen_ultimo_resumo || '',
    ...(input.djenTexts || []),
    ...(input.movimentos || []).map(
      (m) => `${m.nome || ''} ${m.complemento || ''} ${m.descricao || ''}`
    ),
  ];
  return parts.join('\n');
}

type Signals = {
  ba: boolean;
  transito: boolean;
  arquivamento: boolean;
  procedenteParcial: boolean;
  procedente: boolean;
  improcedente: boolean;
  compensacao: boolean;
  seguroPrestamista: boolean;
  documentosNovos: boolean;
  custas: boolean;
  audiencia: boolean;
  cumprimento: boolean;
  liminar: boolean;
  intimacaoPrazo: boolean;
  prazoDias: string | null;
  peticao: boolean;
  publicacao: boolean;
};

function detectSignals(U: string, input: ScriptInput): Signals {
  const et = String(input.evento_tipo || input.eventoTipo || '').toLowerCase();
  return {
    ba:
      !!(input.indicio_busca_apreensao || input.busca_apreensao) ||
      /busca\s+e\s+apreens[aã]o|reintegra[çc][aã]o\s+de\s+posse|apreens[aã]o\s+do\s+ve[ií]culo/i.test(
        U
      ),
    transito:
      !!input.datajud_encerrado_tribunal ||
      et.includes('transito') ||
      et.includes('baixa') ||
      /tr[âa]nsito\s+em\s+julgado|baixa\s+definitiva/i.test(U),
    arquivamento: /arquiv/i.test(U),
    procedenteParcial:
      et === 'sentenca_procedente' ||
      /procedente\s+em\s+parte|julgo\s+procedente\s+em\s+parte|parcialmente\s+procedente/i.test(
        U
      ),
    procedente:
      /julgo\s+procedente(?!\s+em\s+parte)|pedido\s+procedente(?!\s+em)/i.test(U) &&
      !/improcedente|em\s+parte/i.test(U),
    improcedente:
      et === 'sentenca_improcedente' ||
      /improcedente|julgo\s+improcedente/i.test(U),
    compensacao:
      /compensa[çc][aã]o|encontro\s+de\s+contas|abater|valores\s+a\s+serem\s+restitu[ií]dos|artigo\s+368/i.test(
        U
      ),
    seguroPrestamista: /seguro\s+prestamista|tarifa\s+de\s+seguro/i.test(U),
    documentosNovos:
      /juntada\s+de\s+documentos|documentos?\s+novos?|vistas\s+dos\s+autos.*document|manifestar-se[^.]*document/i.test(
        U
      ),
    custas:
      /custa|recolhimento|guia\s+de|d[ií]vida\s+ativa|preparo/i.test(U),
    audiencia:
      et.includes('audiencia') ||
      /audi[êe]ncia|concilia[çc][aã]o/i.test(U),
    cumprimento:
      !!input.em_cumprimento_sentenca ||
      et.includes('cumprimento') ||
      /cumprimento\s+de\s+senten[çc]a|fase\s+de\s+execu[çc][aã]o/i.test(U),
    liminar: /liminar|tutela\s+de\s+urg[êe]ncia|antecipa[çc][aã]o\s+de\s+tutela/i.test(U),
    intimacaoPrazo:
      /intime-se|intimem-se|vistas\s+dos\s+autos|prazo\s+de\s+\d+\s+dias|manifestar-se,?\s+em\s+\d+/i.test(
        U
      ),
    prazoDias: (() => {
      const m = U.match(/(?:prazo\s+de|em)\s+(\d+)\s*\(?\s*dias?\)?/i);
      return m ? m[1] : null;
    })(),
    peticao: /peti[çc][aã]o/i.test(U),
    publicacao: /publica[çc][aã]o|di[aá]rio\s+oficial|djen/i.test(U),
  };
}

function msg(lines: string[]): string {
  return lines.filter((l) => l !== undefined).join('\n');
}

/**
 * Gera 1–3 sugestões adaptadas ao corpus do processo.
 */
export function suggestScripts(input: ScriptInput): ScriptSuggestion[] {
  const nome = firstName(input.clienteNome);
  const cnj = input.protocolo || 'seu processo';
  const corpus = buildCorpus(input);
  const U = corpus; // original case for regex
  const s = detectSignals(U, input);

  const out: ScriptSuggestion[] = [];

  // ——— 0. Busca e apreensão (máxima prioridade)
  if (s.ba) {
    out.push({
      categoria: 'ba',
      titulo: 'Alerta: indício de busca e apreensão',
      quandoUsar: 'Flag ou texto de B.A. / reintegração',
      texto: msg([
        `Olá, ${nome}! Tudo bem?`,
        ``,
        `Preciso te passar uma atualização importante sobre o processo nº ${cnj}.`,
        ``,
        `Identificamos um andamento que pode indicar medida de busca e apreensão (ou algo semelhante). Nossa equipe jurídica já está avaliando o teor completo e as medidas de defesa cabíveis.`,
        ``,
        `Por segurança, recomendamos manter o bem resguardado e aguardar nosso contato com orientações objetivas o quanto antes.`,
        ``,
        `Qualquer dúvida urgente, responda esta mensagem.`,
      ]),
    });
  }

  // ——— 1. Sentença parcial + compensação (ex.: seguro prestamista)
  if (s.procedenteParcial && (s.compensacao || s.seguroPrestamista || s.transito)) {
    out.push({
      categoria: 'merito',
      titulo: 'Decisão parcial + encontro de contas',
      quandoUsar: 'Procedente em parte com compensação / trânsito',
      texto: msg([
        `Olá, ${nome}! Tudo bem?`,
        ``,
        `Trazendo uma atualização importante sobre o seu processo nº ${cnj}.`,
        ``,
        `Temos boas notícias: o juiz deu a decisão final e nós ganhamos uma parte importante da ação!`,
        ``,
        s.seguroPrestamista
          ? `O juiz reconheceu que o banco cobrou indevidamente uma taxa (seguro prestamista) e determinou a devolução desse valor, com juros e correção.`
          : `O juiz acolheu em parte o pedido e determinou devolução de valores indevidos, com juros e correção, nos termos da sentença.`,
        ``,
        `O que acontece agora na prática?`,
        s.compensacao
          ? `Na decisão, o juiz autorizou um "encontro de contas". Isso significa que, se ainda existir dívida ou parcelas em aberto desse contrato, o valor reconhecido pode ser usado para abater o que você deve ao banco — e não necessariamente cair como depósito na sua conta.`
          : `Os valores e a forma de cumprimento ainda passam por conferência. Não antecipamos depósito em conta até a fase de cálculos estar definida.`,
        ``,
        `Qual é o próximo passo?`,
        s.documentosNovos
          ? `A fase de recursos já se encerrou (ou está se encerrando). Houve juntada de documentos novos e nossa equipe está analisando essa papelada com cuidado para conferir cálculos e descontos.`
          : s.custas
            ? `Existe pendência de custas/recolhimento em andamento. Estamos acompanhando para que nada prejudique o fechamento do caso.`
            : `Estamos confirmando se há pendência residual (custas, valores ou ato administrativo) antes do arquivamento definitivo.`,
        ``,
        `Assim que terminarmos essa análise e tivermos os números objetivos, te retorno com os detalhes.`,
        ``,
        `Se tiver qualquer dúvida, é só responder esta mensagem. Estamos à disposição!`,
      ]),
    });
  }

  // ——— 2. Trânsito / arquivamento com documentos ou custas
  if (s.transito || s.arquivamento) {
    if (!(s.procedenteParcial && (s.compensacao || s.seguroPrestamista))) {
      if (s.documentosNovos || s.custas || s.intimacaoPrazo) {
        const prazoTxt = s.prazoDias
          ? ` O juiz (ou o cartório) abriu prazo de ${s.prazoDias} dias para nossa manifestação.`
          : ` Há prazo em aberto para nossa manifestação.`;
        out.push({
          categoria: 'baixa',
          titulo: 'Trânsito + documentos / custas',
          quandoUsar: 'Trânsito com juntada, custas ou intimação',
          texto: msg([
            `Olá, ${nome}! Tudo bem?`,
            ``,
            `Trazendo uma atualização rápida sobre o processo nº ${cnj}.`,
            ``,
            `Tivemos o trânsito em julgado (ou baixa), o que significa que a decisão final foi tomada e não cabem mais recursos sobre o mérito. A fase de discussão principal acabou.`,
            ``,
            `Qual é a situação agora?`,
            s.documentosNovos
              ? `Nos últimos dias houve juntada de documentos novos nos autos.${prazoTxt}`
              : s.custas
                ? `Ainda há pendência de custas/recolhimento antes do arquivamento definitivo.`
                : `Há intimação recente nos autos que exige análise da nossa equipe.${prazoTxt}`,
            ``,
            `Nossa equipe já está revisando tudo com cuidado. Por enquanto, você não precisa fazer nada. Assim que finalizarmos essa análise, eu te aviso com os detalhes objetivos.`,
            ``,
            `Qualquer dúvida, sigo à disposição!`,
          ]),
        });
      } else {
        out.push({
          categoria: 'baixa',
          titulo: 'Trânsito / arquivamento',
          quandoUsar: 'Trânsito ou baixa sem pendência óbvia no texto',
          texto: msg([
            `Olá, ${nome}! Tudo bem?`,
            ``,
            `Passando para te atualizar sobre o processo nº ${cnj}.`,
            ``,
            `Consta trânsito em julgado ou baixa definitiva. Isso significa que a decisão final já foi tomada e não cabem mais recursos sobre o mérito. A fase de discussão neste processo está encerrada no tribunal.`,
            ``,
            `Estamos só confirmando se existe alguma pendência residual (custas, valores ou ato administrativo). Se não houver, o acompanhamento desta ação se encerra; se houver, te avisamos de forma objetiva.`,
            ``,
            `Qualquer dúvida, estamos à disposição.`,
          ]),
        });
      }
    }
  }

  // ——— 3. Improcedente
  if (s.improcedente && !s.procedenteParcial) {
    out.push({
      categoria: 'merito',
      titulo: 'Decisão desfavorável',
      quandoUsar: 'Sentença improcedente',
      texto: msg([
        `Olá, ${nome}! Tudo bem?`,
        ``,
        `Preciso te atualizar sobre o processo nº ${cnj}.`,
        ``,
        `Houve uma decisão do juiz que não acolheu o pedido principal. Isso não significa que o assunto acabou automaticamente: nossa equipe está lendo o teor completo e avaliando se cabe recurso ou outra medida.`,
        ``,
        `Por enquanto, você não precisa comparecer a lugar nenhum. Em breve te retorno com a orientação clara do que fazer (ou se só acompanhamos o prazo).`,
        ``,
        `Qualquer dúvida, responda esta mensagem.`,
      ]),
    });
  }

  // ——— 4. Procedente (total) sem compensação já tratada
  if (s.procedente && !s.procedenteParcial && out.length < 3) {
    out.push({
      categoria: 'merito',
      titulo: 'Decisão favorável',
      quandoUsar: 'Sentença procedente',
      texto: msg([
        `Olá, ${nome}! Tudo bem?`,
        ``,
        `Boa notícia sobre o processo nº ${cnj}: o juiz acolheu o pedido.`,
        ``,
        `Estamos conferindo os detalhes da decisão e o que vem na sequência (valores, prazos e atos do banco/parte contrária). Não antecipamos valores na conta até a fase de cumprimento estar definida.`,
        ``,
        `Assim que tivermos o próximo passo objetivo, te aviso.`,
        ``,
        `Qualquer dúvida, estamos à disposição!`,
      ]),
    });
  }

  // ——— 5. Audiência
  if (s.audiencia && out.length < 3) {
    out.push({
      categoria: 'merito',
      titulo: 'Audiência',
      quandoUsar: 'Designação de audiência',
      texto: msg([
        `Olá, ${nome}! Tudo bem?`,
        ``,
        `Identificamos a designação de audiência no processo nº ${cnj}.`,
        ``,
        `Nossa equipe está organizando os próximos passos e te orienta com data, local (ou link) e o que você precisa fazer — se for necessário comparecer.`,
        ``,
        `Por enquanto, não se desloque sem nossa confirmação. Em breve te passo as orientações práticas.`,
        ``,
        `Qualquer dúvida, estou à disposição.`,
      ]),
    });
  }

  // ——— 6. Cumprimento de sentença
  if (s.cumprimento && out.length < 3) {
    out.push({
      categoria: 'execucao',
      titulo: 'Fase de cumprimento',
      quandoUsar: 'Cumprimento de sentença / execução',
      texto: msg([
        `Olá, ${nome}! Tudo bem?`,
        ``,
        `O processo nº ${cnj} avançou para a fase de cumprimento da decisão (quando se discute valor e forma de pagar/descontar).`,
        ``,
        `Nossa equipe está revisando os atos e os números. É normal essa etapa demorar um pouco e exigir conferência cuidadosa para não haver erro no cálculo.`,
        ``,
        `Assim que tivermos um próximo passo claro, te retorno. Qualquer dúvida, responda esta mensagem.`,
      ]),
    });
  }

  // ——— 7. Documentos novos / intimação (sem trânsito já coberto)
  if (
    (s.documentosNovos || s.intimacaoPrazo) &&
    !s.transito &&
    out.length < 3
  ) {
    const prazoTxt = s.prazoDias
      ? ` Há um prazo de ${s.prazoDias} dias para nossa resposta.`
      : ` Há prazo em aberto para nossa análise.`;
    out.push({
      categoria: 'andamento',
      titulo: 'Documentos / intimação',
      quandoUsar: 'Juntada ou intimação com prazo',
      texto: msg([
        `Olá, ${nome}! Tudo bem?`,
        ``,
        `Trazendo uma atualização rápida sobre o processo nº ${cnj}.`,
        ``,
        s.documentosNovos
          ? `O tribunal (ou a outra parte) juntou documentos novos e pediu nossa manifestação.${prazoTxt}`
          : `Houve intimação nos autos exigindo análise da nossa equipe.${prazoTxt}`,
        ``,
        `Já estamos cuidando disso. Por enquanto você não precisa fazer nada. Assim que tivermos a conclusão, te retorno com orientação objetiva.`,
        ``,
        `Qualquer dúvida, estou à disposição!`,
      ]),
    });
  }

  // ——— 8. Liminar
  if (s.liminar && out.length < 3) {
    out.push({
      categoria: 'merito',
      titulo: 'Liminar / tutela',
      quandoUsar: 'Decisão de liminar ou tutela',
      texto: msg([
        `Olá, ${nome}! Tudo bem?`,
        ``,
        `Houve decisão de liminar (ou tutela de urgência) no processo nº ${cnj}.`,
        ``,
        `Nossa equipe está lendo o teor completo para te explicar, em linguagem simples, o que foi deferido ou indeferido e o que muda no dia a dia do seu caso.`,
        ``,
        `Em breve te retorno com a orientação. Qualquer dúvida, responda esta mensagem.`,
      ]),
    });
  }

  // ——— Fallback: novidade genérica (nunca vazio se há sinal de andamento)
  if (out.length === 0) {
    const temNovidade =
      input.tem_novo_andamento ||
      input.tem_atualizacao_pos_retorno ||
      input.djen_nova_comunicacao ||
      s.publicacao ||
      s.peticao ||
      (input.movimentos && input.movimentos.length > 0);

    out.push({
      categoria: 'andamento',
      titulo: temNovidade ? 'Atualização de andamento' : 'Acompanhamento',
      quandoUsar: temNovidade
        ? 'Nova movimentação sem classificação forte'
        : 'Contato de rotina',
      texto: temNovidade
        ? msg([
            `Olá, ${nome}! Tudo bem?`,
            ``,
            `Trazendo uma atualização sobre o processo nº ${cnj}.`,
            ``,
            s.documentosNovos
              ? `O tribunal juntou novos documentos e abriu prazo para nossa manifestação.`
              : `Houve uma nova movimentação no tribunal. Nossa equipe já está analisando o teor completo.`,
            ``,
            `Por enquanto você não precisa fazer nada. Assim que tivermos a conclusão, te retorno com as orientações necessárias — sem adiantar resultado antes da análise.`,
            ``,
            `Qualquer dúvida, estamos à disposição.`,
          ])
        : msg([
            `Olá, ${nome}! Tudo bem?`,
            ``,
            `Passando para atualizar o acompanhamento do processo nº ${cnj}.`,
            ``,
            `Seguimos monitorando os andamentos. Qualquer novidade relevante, te aviso de forma clara e objetiva.`,
            ``,
            `Se precisar de algo neste intervalo, responda esta mensagem.`,
          ]),
    });
  }

  // Reforço: se ainda sobrou espaço e há template de catálogo útil, não poluir —
  // prioridade é mensagem adaptativa acima.

  return out.slice(0, 3);
}

/** Compat: preenche placeholders de templates legados do catálogo */
export function applyCatalogTemplate(
  s: ScriptTemplate,
  nome: string,
  cnj: string,
  dateRetornoStr?: string | null,
  dataMovStr?: string
): ScriptSuggestion {
  const displayRetorno = fmtDate(dateRetornoStr) || 'nos últimos dias';
  const displayMov = fmtDate(dataMovStr) || 'recentemente';
  return {
    categoria: s.categoria,
    titulo: s.titulo,
    quandoUsar: s.quandoUsar,
    texto: s.texto
      .replace(/\[CLIENTE\]|\[Nome\]/g, nome)
      .replace(/\[PROTOCOLO\]|\[CNJ\]/g, cnj)
      .replace(/\[Data\]/g, displayRetorno)
      .replace(/\[DataMov\]/g, displayMov),
  };
}
