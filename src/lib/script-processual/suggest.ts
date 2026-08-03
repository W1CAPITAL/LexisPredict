/**
 * Scripts ao cliente a partir do TEOR real (DataJud + DJEN).
 * Não usa catálogo genérico de "estamos validando".
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

function decodeHtml(s: string) {
  return String(s || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&aacute;/gi, "á")
    .replace(/&eacute;/gi, "é")
    .replace(/&iacute;/gi, "í")
    .replace(/&oacute;/gi, "ó")
    .replace(/&uacute;/gi, "ú")
    .replace(/&atilde;/gi, "ã")
    .replace(/&otilde;/gi, "õ")
    .replace(/&ccedil;/gi, "ç")
    .replace(/&Acirc;/gi, "Â")
    .replace(/&acirc;/gi, "â")
    .replace(/&Agrave;/gi, "À")
    .replace(/&agrave;/gi, "à")
    .replace(/&ecirc;/gi, "ê")
    .replace(/&ocirc;/gi, "ô")
    .replace(/&deg;/gi, "°")
    .replace(/&sect;/gi, "§")
    .replace(/&ndash;/gi, "–")
    .replace(/&mdash;/gi, "—")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstName(full?: string) {
  const p = String(full || "Cliente")
    .trim()
    .split(/\s+/)
    .filter(Boolean)[0];
  if (!p) return "Cliente";
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
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

function collectCorpus(input: ScriptInput): string {
  const parts: string[] = [];
  for (const t of input.djenTexts || []) parts.push(decodeHtml(t));
  if (input.djen_ultimo_resumo) parts.push(decodeHtml(input.djen_ultimo_resumo));
  if (input.evento_resumo || input.eventoResumo) {
    parts.push(decodeHtml(input.evento_resumo || input.eventoResumo || ""));
  }
  if (input.datajud_ultimo_nome) parts.push(decodeHtml(input.datajud_ultimo_nome));
  for (const m of input.movimentos || []) {
    parts.push(decodeHtml(`${m.nome || ""} ${m.complemento || ""} ${m.descricao || ""}`));
  }
  return parts.join(" \n ");
}

function upper(s: string) {
  return s.toUpperCase();
}

type Fato = {
  id: string;
  titulo: string;
  quandoUsar: string;
  score: number;
  /** Mensagem completa, já com nome e CNJ */
  texto: string;
};

/**
 * Lê o corpus e monta 1 mensagem principal (e no máx. 1 alternativa) fiéis ao teor.
 */
export function suggestScripts(input: ScriptInput): ScriptSuggestion[] {
  const nome = firstName(input.clienteNome);
  const cnj = input.protocolo || "";
  const corpus = collectCorpus(input);
  const U = upper(corpus);

  const fatos: Fato[] = [];

  const hasBA =
    input.indicio_busca_apreensao ||
    input.busca_apreensao ||
    input.evento_tipo === "ba" ||
    input.eventoTipo === "ba" ||
    /BUSCA\s*E\s*APREENS/.test(U);

  const hasIndeferimento =
    /INDEFER.*PETI[CÇ][AÃ]O\s+INICIAL|INDEFIRO\s+A\s+PETI[CÇ][AÃ]O\s+INICIAL|INDEFERIMENTO\s+DA\s+PETI[CÇ][AÃ]O\s+INICIAL/.test(
      U
    );

  const hasExtincaoSemMerito =
    /EXTIN[CÇ].{0,40}SEM\s*(RESOLU[CÇ][AÃ]O|APRECIA[CÇ][AÃ]O)\s+DO\s+M[EÉ]RITO|JULGO\s+EXTINTO\s+O\s+PROCESSO|ARTIGO\s*485|ART\.\s*485/.test(
      U
    );

  const hasTransito =
    /TR[AÂ]NSITO\s+EM\s+JULGADO/.test(U) ||
    !!input.datajud_encerrado_tribunal ||
    input.evento_tipo === "transito_ou_baixa" ||
    input.eventoTipo === "transito_ou_baixa";

  const hasArquivo =
    /REMETAM-SE\s+OS\s+AUTOS\s+AO\s+ARQUIVO|BAIXA\s+DEFINITIVA|NADA\s+TENDO\s+SIDO\s+REQUERIDO/.test(U);

  const hasProcFirma =
    /PROCURA[CÇ][AÃ]O.{0,40}FIRMA\s+RECONHECIDA|FIRMA\s+RECONHECIDA/.test(U);

  const hasCustasDocs =
    /CUSTAS|PREPARO|DECLARA[CÇ][OÕ]ES\s+DE\s+RENDA|EXTRATOS\s+BANC|HIPOSSUFICI|JUSTI[CÇ]A\s+GRATUITA|GRATUIDADE/.test(
      U
    );

  const hasLitiganciaPredatoria =
    /LITIG[AÂ]NCIA\s+PREDAT|NUMOPEDE|ABUSO\s+DE\s+DIREITO\s+PROCESSUAL|DEMANDAS\s+MASSIFICADAS/.test(
      U
    );

  const hasEmenda = /EMENDA\s+[AÀ]\s+INICIAL/.test(U);
  const hasRedistribuicao = /REDISTRIBU/.test(U);

  // ——— Caso: indeferimento + extinção (+ trânsito/arquivo) ———
  if (hasIndeferimento || (hasExtincaoSemMerito && (hasTransito || hasArquivo || hasProcFirma))) {
    const motivos: string[] = [];
    if (hasProcFirma) {
      motivos.push("procuração com firma reconhecida");
    }
    if (hasCustasDocs) {
      motivos.push(
        "comprovação de renda/hipossuficiência ou recolhimento de custas"
      );
    }
    if (hasLitiganciaPredatoria && !motivos.length) {
      motivos.push("regularização de representação / documentos exigidos pelo juízo");
    }
    if (hasEmenda && !motivos.length) {
      motivos.push("emenda à inicial / documentos pendentes");
    }
    const motivoStr =
      motivos.length > 0
        ? motivos.join(" e ")
        : "pendências formais/documentais na fase inicial";

    const encerrado = hasTransito || hasArquivo || !!input.datajud_encerrado_tribunal;

    fatos.push({
      id: "indeferimento_arquivo",
      titulo: encerrado
        ? "Extinção e arquivamento — orientação clara"
        : "Indeferimento da inicial — orientação",
      quandoUsar:
        "Teor com indeferimento da petição inicial / extinção sem mérito (art. 485)",
      score: 300,
      texto: [
        `Olá, ${nome}! Tudo bem?`,
        ``,
        `Passando para te atualizar sobre o processo nº ${cnj}.`,
        ``,
        `O juízo encerrou a tramitação desta ação por ausência de cumprimento de exigências da fase inicial (${motivoStr}). Com isso, a petição inicial foi indeferida e o processo foi extinto sem resolução do mérito` +
          (encerrado
            ? `, com trânsito em julgado e encaminhamento ao arquivo`
            : ``) +
          `.`,
        ``,
        `O que isso significa na prática? O mérito do seu pedido (o direito em si) não foi julgado — ou seja, você não “perdeu a causa” no mérito. Foi um encerramento formal. Em regra, é possível avaliar o ingresso de nova ação com a documentação regularizada, se fizer sentido no seu caso.`,
        ``,
        `Se quiser seguir com a documentação em ordem ou tiver dúvida, nossa equipe orienta o próximo passo.`,
      ].join("\n"),
    });
  } else if (hasExtincaoSemMerito) {
    fatos.push({
      id: "extincao_sem_merito",
      titulo: "Extinção sem mérito",
      quandoUsar: "Extinção sem julgamento do mérito",
      score: 280,
      texto: [
        `Olá, ${nome}. Sobre o processo ${cnj}: o tribunal extinguiu o feito sem resolução do mérito.`,
        ``,
        `Isso significa que o pedido principal não foi analisado (não houve vitória nem derrota no mérito). Estamos registrando o fundamento e as opções cabíveis (recurso, emenda ou novo protocolo, conforme o caso).`,
        ``,
        `Se quiser, alinhamos o próximo passo com a documentação necessária.`,
      ].join("\n"),
    });
  } else if (hasTransito || hasArquivo) {
    fatos.push({
      id: "transito_arquivo",
      titulo: "Trânsito / arquivamento",
      quandoUsar: "Trânsito em julgado ou baixa definitiva",
      score: 250,
      texto: [
        `Olá, ${nome}. No processo ${cnj} consta trânsito em julgado e/ou arquivamento/baixa.`,
        ``,
        `A fase de discussão neste processo está encerrada no tribunal. Estamos só confirmando se há alguma pendência residual (custas, valores ou ato administrativo). Se não houver, o acompanhamento desta ação é encerrado; se houver, te avisamos objetivamente.`,
      ].join("\n"),
    });
  }

  if (hasBA) {
    fatos.push({
      id: "ba",
      titulo: "Busca e apreensão — urgente",
      quandoUsar: "Indício de B.A. no teor",
      score: 400,
      texto: `Olá, ${nome}. No processo ${cnj} identificamos movimentação que pode indicar busca e apreensão ou medida urgente. Nossa equipe está confirmando o teor completo e te retorna com orientação do que fazer — priorize este contato.`,
    });
  }

  if (hasProcFirma && hasCustasDocs && !hasIndeferimento && !hasExtincaoSemMerito) {
    fatos.push({
      id: "exigencias_iniciais",
      titulo: "Documentos e custas exigidos",
      quandoUsar: "Despacho pedindo procuração com firma e/ou prova de hipossuficiência",
      score: 220,
      texto: [
        `Olá, ${nome}. No processo ${cnj} o juízo determinou providências na fase inicial:`,
        `• juntada de procuração com firma reconhecida` +
          (hasLitiganciaPredatoria ? ` (diretrizes contra litigância predatória / NUMOPEDE)` : ``) +
          `;`,
        `• comprovação de impossibilidade de pagar custas (ex.: declarações de renda, extratos) ou o recolhimento das custas.`,
        ``,
        `Há prazo para cumprir. Se não regularizar, o risco é o indeferimento da inicial. Nossa equipe lista exatamente o que enviar e o prazo.`,
      ].join("\n"),
    });
  }

  if (hasRedistribuicao && fatos.length === 0) {
    fatos.push({
      id: "redistribuicao",
      titulo: "Redistribuição de foro",
      quandoUsar: "Processo redistribuído por competência",
      score: 150,
      texto: `Olá, ${nome}. O processo ${cnj} foi redistribuído para outro foro/vara por questão de competência territorial. Isso não decide o mérito; só muda onde o processo tramita. Continuamos o acompanhamento no novo juízo.`,
    });
  }

  if (input.em_cumprimento_sentenca && fatos.length === 0) {
    fatos.push({
      id: "cumprimento",
      titulo: "Cumprimento de sentença",
      quandoUsar: "Fase de cumprimento",
      score: 160,
      texto: `Olá, ${nome}. O processo ${cnj} está em cumprimento de sentença. Acompanhamos as medidas para efetivar o que foi decidido e te atualizamos sobre prazos e eventuais valores.`,
    });
  }

  // Fallback só se não houver fato forte
  if (fatos.length === 0) {
    const dataRet = fmtDate(input.ultimoRetorno);
    fatos.push({
      id: "novidade",
      titulo: "Atualização de andamento",
      quandoUsar: "Há movimentação sem classificação forte no teor",
      score: 50,
      texto: dataRet
        ? `Olá, ${nome}. Houve nova movimentação no processo ${cnj} após nosso contato de ${dataRet}. Já estamos lendo o teor no tribunal/diário e te retorno com o que isso muda no seu caso — de forma objetiva.`
        : `Olá, ${nome}. Houve nova movimentação no processo ${cnj}. Já estamos lendo o teor no tribunal/diário e te retorno com o que isso muda no seu caso — de forma objetiva.`,
    });
  }

  fatos.sort((a, b) => b.score - a.score);

  // 1 principal; no máximo 1 alternativa se for exigência documental ainda relevante e principal for extinção
  const out: ScriptSuggestion[] = [];
  const top = fatos[0];
  out.push({
    id: top.id,
    categoria: top.id,
    titulo: top.titulo,
    quandoUsar: top.quandoUsar,
    score: top.score,
    texto: top.texto,
  });

  const second = fatos.find(
    (f) =>
      f.id !== top.id &&
      (f.id === "exigencias_iniciais" || f.id === "ba") &&
      f.score >= 200
  );
  if (second) {
    out.push({
      id: second.id,
      categoria: second.id,
      titulo: second.titulo,
      quandoUsar: second.quandoUsar,
      score: second.score,
      texto: second.texto,
    });
  }

  return out.slice(0, 2);
}
