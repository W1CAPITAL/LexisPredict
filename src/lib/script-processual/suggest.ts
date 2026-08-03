/**
 * Sugestão de resposta ao cliente — 1 a 2 scripts úteis, baseados no teor real.
 */
import { format, parse, parseISO, isValid } from "date-fns";

export type ScriptSuggestion = {
  id: string;
  categoria: string;
  titulo: string;
  quandoUsar: string;
  texto: string;
  score?: number;
};

export interface ScriptInput {
  clienteNome?: string;
  protocolo?: string;
  ultimoRetorno?: string | null;
  movimentos?: Array<{ nome?: string; complemento?: string; descricao?: string; dataHora?: string }>;
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
  datajud_ultimo_nome?: string | null;
}

function fmtDate(raw?: string | null): string {
  if (!raw) return "";
  try {
    const clean = String(raw).trim();
    const d = clean.includes("/")
      ? parse(clean.slice(0, 10), "dd/MM/yyyy", new Date())
      : parseISO(clean.slice(0, 10));
    if (isValid(d)) return format(d, "dd/MM/yyyy");
  } catch {
    /* */
  }
  return "";
}

function firstName(full?: string) {
  const p = String(full || "Cliente")
    .trim()
    .split(/\s+/)
    .filter(Boolean)[0];
  if (!p) return "Cliente";
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
}

function blobFrom(input: ScriptInput) {
  const sortedMovs = [...(input.movimentos || [])].sort(
    (a, b) => new Date(b.dataHora || 0).getTime() - new Date(a.dataHora || 0).getTime()
  );
  return [
    input.evento_resumo || input.eventoResumo,
    input.djen_ultimo_resumo,
    input.datajud_ultimo_nome,
    ...(input.djenTexts || []),
    ...sortedMovs.slice(0, 20).map((m) => `${m.nome || ""} ${m.complemento || ""} ${m.descricao || ""}`),
  ]
    .join(" ")
    .toUpperCase();
}

/** Detecta o fato principal a partir do teor (prioridade: pior → genérico) */
function detectarFato(blob: string, input: ScriptInput): {
  id: string;
  titulo: string;
  quandoUsar: string;
  texto: (nome: string, cnj: string) => string;
} {
  const isBA =
    input.indicio_busca_apreensao ||
    input.busca_apreensao ||
    input.eventoTipo === "ba" ||
    input.evento_tipo === "ba" ||
    /BUSCA\s*E\s*APREENS/.test(blob);

  if (isBA) {
    return {
      id: "ba",
      titulo: "Busca e apreensão — prioridade",
      quandoUsar: "Quando há indício de B.A. no tribunal ou no diário",
      texto: (nome, cnj) =>
        `Olá, ${nome}. Identificamos no processo ${cnj} movimentação que pode indicar busca e apreensão ou medida urgente. Nossa equipe está confirmando o teor completo agora. Em seguida retornamos com orientação objetiva do que fazer — não ignore este contato.`,
    };
  }

  if (/INDEFER.*PETI[CÇ][AÃ]O\s+INICIAL|INDEFIRO\s+A\s+PETI/.test(blob)) {
    return {
      id: "indeferimento_inicial",
      titulo: "Indeferimento da inicial",
      quandoUsar: "Quando o juízo indeferiu a petição inicial",
      texto: (nome, cnj) =>
        `Olá, ${nome}. No processo ${cnj} o juízo indeferiu a petição inicial e extinguiu o feito sem julgamento do mérito. Isso significa que a ação não avançou para análise do pedido em si. Estamos avaliando o motivo (documentação, custas, legitimidade ou outro fundamento) e se cabe recurso ou novo ajuizamento. Retornamos com a orientação concreta.`,
    };
  }

  if (/EXTIN[CÇ].*SEM\s*(RESOLU[CÇ][AÃ]O|APRECIA[CÇ][AÃ]O)\s+DO\s+M[EÉ]RITO|ARTIGO\s*485/.test(blob)) {
    return {
      id: "extincao_sem_merito",
      titulo: "Extinção sem mérito",
      quandoUsar: "Processo extinto sem julgamento do mérito",
      texto: (nome, cnj) =>
        `Olá, ${nome}. O processo ${cnj} foi extinto sem resolução do mérito. Na prática, o tribunal encerrou o trâmite sem decidir se o pedido era procedente ou não. Estamos verificando o fundamento e as opções (recurso, emenda ou novo protocolo, se couber). Já te atualizamos com o próximo passo.`,
    };
  }

  if (/TR[AÂ]NSITO\s+EM\s+JULGADO|BAIXA\s+DEFINITIVA|REMETAM-SE\s+OS\s+AUTOS\s+AO\s+ARQUIVO/.test(blob) ||
      input.datajud_encerrado_tribunal ||
      input.evento_tipo === "transito_ou_baixa" ||
      input.eventoTipo === "transito_ou_baixa") {
    return {
      id: "transito_baixa",
      titulo: "Trânsito / arquivamento",
      quandoUsar: "Trânsito em julgado, baixa ou arquivamento",
      texto: (nome, cnj) =>
        `Olá, ${nome}. No processo ${cnj} consta trânsito em julgado e/ou baixa/arquivamento. Isso indica encerramento da fase de discussão no tribunal. Estamos confirmando se ainda há algum valor, custas ou providência residual e, se não houver, o acompanhamento interno é encerrado. Qualquer pendência, avisamos.`,
    };
  }

  if (/PROCEDENTE|JULG[OA]\s+PROCEDENTE|PROVIMENTO|REFORMA\s+DA\s+SENTEN/.test(blob)) {
    return {
      id: "merito_favoravel",
      titulo: "Decisão de mérito",
      quandoUsar: "Sentença/acórdão com resultado material",
      texto: (nome, cnj) =>
        `Olá, ${nome}. Houve decisão de mérito no processo ${cnj}. Estamos lendo o teor completo (o que foi reconhecido, valores e prazos) para te explicar de forma clara e sem juridiquês. Em seguida alinhamos os próximos passos.`,
    };
  }

  if (/CUSTAS|PREPARO|RECOLHIMENTO|JUSTI[CÇ]A\s+GRATUITA|GRATUIDADE/.test(blob)) {
    return {
      id: "custas",
      titulo: "Custas / gratuidade",
      quandoUsar: "Exigência de custas ou documentos de hipossuficiência",
      texto: (nome, cnj) =>
        `Olá, ${nome}. No processo ${cnj} o juízo tratou de custas ou comprovação para gratuidade. Estamos identificando exatamente o que foi pedido e o prazo. Se precisar de documentos seus (comprovantes, declaração de isento etc.), listamos tudo de forma objetiva.`,
    };
  }

  if (/PROCURA[CÇ][AÃ]O|FIRMA\s+RECONHECIDA|EMENDA\s+[AÀ]\s+INICIAL|JUNTADA\s+DE/.test(blob)) {
    return {
      id: "emenda_docs",
      titulo: "Documentos / emenda",
      quandoUsar: "Pedido de emenda, procuração ou documentos",
      texto: (nome, cnj) =>
        `Olá, ${nome}. O juízo solicitou regularização de documentos no processo ${cnj} (pode ser procuração, emenda ou comprovantes). Estamos separando o que falta. Se precisar de assinatura ou arquivo da sua parte, te avisamos com prazo e modelo.`,
    };
  }

  if (/AUDI[EÊ]NCIA|CONCILIA[CÇ][AÃ]O/.test(blob)) {
    return {
      id: "audiencia",
      titulo: "Audiência",
      quandoUsar: "Designação ou alteração de audiência",
      texto: (nome, cnj) =>
        `Olá, ${nome}. Há movimentação de audiência no processo ${cnj}. Estamos confirmando data, horário e se sua presença é necessária. Assim que estiver validado, enviamos as orientações para o dia.`,
    };
  }

  if (input.em_cumprimento_sentenca || input.evento_tipo === "cumprimento_sentenca") {
    return {
      id: "cumprimento",
      titulo: "Cumprimento de sentença",
      quandoUsar: "Fase de cumprimento / execução da decisão",
      texto: (nome, cnj) =>
        `Olá, ${nome}. O processo ${cnj} está em fase de cumprimento de sentença. Estamos acompanhando as medidas para efetivar o que foi decidido e te atualizamos sobre prazos e eventuais valores.`,
    };
  }

  // Genérico — só se realmente só houver “novidade”
  const dataRet = fmtDate(input.ultimoRetorno) || "nosso último contato";
  return {
    id: "novidade_generica",
    titulo: "Nova movimentação",
    quandoUsar: "Há andamento novo, sem classificação mais específica",
    texto: (nome, cnj) =>
      `Olá, ${nome}. Houve nova movimentação no processo ${cnj} após ${dataRet}. Nossa equipe está lendo o teor no sistema do tribunal e retorna com a orientação adequada, sem antecipar conclusões.`,
  };
}

/**
 * Retorna no máximo 2 scripts: o principal (fato detectado) e, se fizer sentido, um complementar curto.
 */
export function suggestScripts(input: ScriptInput): ScriptSuggestion[] {
  const nome = firstName(input.clienteNome);
  const cnj = input.protocolo || "";
  const blob = blobFrom(input);
  const fato = detectarFato(blob, input);

  const primary: ScriptSuggestion = {
    id: fato.id,
    categoria: fato.id,
    titulo: fato.titulo,
    quandoUsar: fato.quandoUsar,
    score: 100,
    texto: fato.texto(nome, cnj),
  };

  const out: ScriptSuggestion[] = [primary];

  // Complementar: publicação DJEN só se não for o fato principal e houver sinal de diário
  if (
    primary.id !== "novidade_generica" &&
    (input.djen_nova_comunicacao || /DI[AÁ]RIO|DISPONIBILIZA[CÇ][AÃ]O|PUBLICA[CÇ][AÃ]O/.test(blob)) &&
    !["transito_baixa", "indeferimento_inicial", "extincao_sem_merito"].includes(primary.id)
  ) {
    out.push({
      id: "djen_complemento",
      categoria: "djen",
      titulo: "Publicação no diário",
      quandoUsar: "Há texto no DJEN além do andamento do tribunal",
      score: 60,
      texto: `Olá, ${nome}. Além do andamento no sistema, há publicação oficial (diário) ligada ao processo ${cnj}. Estamos cruzando o teor com o que já consta nos autos. Se surgir prazo ou providência, avisamos com clareza.`,
    });
  }

  return out.slice(0, 2);
}
