/**
 * Processos parados — v2.0 (lote melhorias)
 * Datas: DataJud + djen_ultima_data + evento_data
 * Estados: sem_scan | parado_confirmado | parado_provavel
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import { isBuscaApreensaoReal } from "@/lib/ba-real";
import type { LegalCase } from './case-logic';
import { isCasoEncerrado } from './status-encerrado';

export type FaixaParado = 0 | 7 | 15 | 30 | 60 | 90 | 120 | 180;

/** Classificação operacional */
export type EstadoParado = 'sem_scan' | 'parado_confirmado' | 'parado_provavel';

export interface ProcessoParadoItem {
  case: LegalCase;
  estado: EstadoParado;
  diasParadoTribunal: number;
  diasSemRetornoEquipe: number | null;
  fonteData: 'datajud' | 'djen' | 'evento' | 'scan' | 'retorno' | 'desconhecida';
  dataReferencia: string | null;
  ultimoSinalResumo: string;
  oportunidades: string[];
  scoreAcao: number;
  /** Tratado localmente (localStorage / futuro banco) */
  tratado?: boolean;
  temContestacao: boolean;
  temSentenca: boolean;
  temReplica: boolean;
  cumprimentoRecebido?: boolean;
  cumprimentoAberto?: boolean;
  replicaPendente?: boolean;
}

export function parseDateLoose(raw?: string | null): Date | null {
  if (!raw || !String(raw).trim()) return null;
  const s = String(raw).trim();
  try {
    if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) {
      const [dd, mm, yyyy] = s.slice(0, 10).split('/').map(Number);
      const d = new Date(yyyy, mm - 1, dd);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(s.includes('T') ? s : s.slice(0, 10));
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function diasDesde(d: Date | null, now = new Date()): number | null {
  if (!d) return null;
  const ms = now.getTime() - d.getTime();
  if (ms < 0) return 0;
  return Math.floor(ms / 86400000);
}

/**
 * Última data de movimento do tribunal.
 * Campos reais do app: datajud_ultimo_movimento, djen_ultima_data, evento_data.
 */
export function ultimaDataTribunal(c: LegalCase): {
  date: Date | null;
  fonte: ProcessoParadoItem['fonteData'];
  raw: string | null;
  resumo: string;
  temSinalTribunal: boolean;
} {
  const any = c as any;
  const candidates: {
    raw: string | null | undefined;
    fonte: ProcessoParadoItem['fonteData'];
    resumo: string;
    isTribunal: boolean;
  }[] = [
    {
      raw: c.datajud_ultimo_movimento || any.datajud_ultimo_movimento,
      fonte: 'datajud',
      resumo: String(c.datajud_ultimo_nome || c.evento_resumo || 'Movimento DataJud'),
      isTribunal: true,
    },
    {
      // campo canônico no Lexis (não djen_ultimo_data)
      raw: c.djen_ultima_data || any.djen_ultima_data || any.djen_ultimo_data || any.djen_data_disponibilizacao,
      fonte: 'djen',
      resumo: String(c.djen_ultimo_resumo || any.djen_ultimo_resumo || 'Publicação DJEN').slice(0, 180),
      isTribunal: true,
    },
    {
      raw: c.evento_data || any.evento_data,
      fonte: 'evento',
      resumo: String(c.evento_resumo || 'Evento unificado'),
      isTribunal: true,
    },
    {
      raw: c.datajud_consultado_em || any.djen_consultado_em,
      fonte: 'scan',
      resumo: 'Última consulta ao tribunal (sem movimento novo no cadastro)',
      isTribunal: false,
    },
  ];

  let best: {
    date: Date;
    fonte: ProcessoParadoItem['fonteData'];
    raw: string;
    resumo: string;
    isTribunal: boolean;
  } | null = null;

  for (const cand of candidates) {
    const d = parseDateLoose(cand.raw);
    if (!d) continue;
    // Preferir sinal de tribunal sobre “só scan”; entre iguais, data mais recente
    if (
      !best ||
      (cand.isTribunal && !best.isTribunal) ||
      (cand.isTribunal === best.isTribunal && d.getTime() > best.date.getTime()) ||
      (!cand.isTribunal && !best.isTribunal && d.getTime() > best.date.getTime())
    ) {
      // Se já temos tribunal e cand é só scan, só troca se scan for mais recente E não houver tribunal
      if (best?.isTribunal && !cand.isTribunal) continue;
      best = {
        date: d,
        fonte: cand.fonte,
        raw: String(cand.raw),
        resumo: cand.resumo,
        isTribunal: cand.isTribunal,
      };
    }
  }

  // Preferir a data de tribunal mais recente entre candidatos isTribunal
  let bestTribunal: typeof best = null;
  for (const cand of candidates.filter((x) => x.isTribunal)) {
    const d = parseDateLoose(cand.raw);
    if (!d) continue;
    if (!bestTribunal || d.getTime() > bestTribunal.date.getTime()) {
      bestTribunal = {
        date: d,
        fonte: cand.fonte,
        raw: String(cand.raw),
        resumo: cand.resumo,
        isTribunal: true,
      };
    }
  }
  if (bestTribunal) {
    return {
      date: bestTribunal.date,
      fonte: bestTribunal.fonte,
      raw: bestTribunal.raw,
      resumo: bestTribunal.resumo,
      temSinalTribunal: true,
    };
  }

  if (best) {
    return {
      date: best.date,
      fonte: best.fonte,
      raw: best.raw,
      resumo: best.resumo,
      temSinalTribunal: best.isTribunal,
    };
  }

  const ret = parseDateLoose(c.ultimoRetorno || any.ultimo_retorno);
  if (ret) {
    return {
      date: ret,
      fonte: 'retorno',
      raw: String(c.ultimoRetorno || any.ultimo_retorno),
      resumo: 'Sem movimento de tribunal no cadastro — só último retorno da equipe',
      temSinalTribunal: false,
    };
  }

  return {
    date: null,
    fonte: 'desconhecida',
    raw: null,
    resumo: 'Sem data de movimento conhecida (auditar primeiro)',
    temSinalTribunal: false,
  };
}

/**
 * Texto unificado para detectar meros "sinais" do processo (eventos + nomes DataJud/DJEN).
 */
function textoProcessual(c: LegalCase): string {
  const any = c as any;
  return [
    c.evento_tipo,
    c.evento_resumo,
    c.datajud_ultimo_nome,
    any.djen_ultimo_resumo,
    c.observacao,
    c.situacao,
  ]
    .map((x) => String(x || '').toUpperCase())
    .join(' | ');
}

/**
 * Ainda há providência útil **dentro do processo** (não só CRM/telefone).
 * Parado = sem movimento útil no tribunal; acionável = ainda cabe ato processual.
 */

/**
 * Sinal dominante é só custas/guia/taxa — processo ainda pode continuar;
 * não entra na fila de parados acionáveis (baixa relevância operacional).
 */

/** Flags de fase — heurística sobre evento + texto DataJud/DJEN (não é certidão). */
export type FlagsFaseParado = {
  temContestacao: boolean;
  temSentenca: boolean;
  temReplica: boolean;
  /** Cumprimento com levantamento / pagamento / quitação já sinalizados */
  cumprimentoRecebido: boolean;
  /** Sentença ou cumprimento em curso, ainda sem satisfação */
  cumprimentoAberto: boolean;
  replicaPendente: boolean;
  temCitacao: boolean;
  temAudiencia: boolean;
};

function blobProcessual(c: LegalCase): string {
  const any = c as any;
  return [
    c.evento_tipo,
    c.evento_resumo,
    (c as any).datajud_ultimo_nome,
    any.djen_ultimo_resumo,
    any.datajud_encerrado_motivo,
    c.observacao,
    c.situacao,
    any.classe_processual,
    any.movimento_nome,
  ]
    .map((x) => String(x || '').toUpperCase())
    .join(' | ');
}


export function isCumprimentoRecebido(c: LegalCase): boolean {
  const any = c as any;
  const txt = blobProcessual(c);
  if (any.cumprimento_satisfeito === true || any.alvara_levantado === true) return true;
  return (
    /ALVAR[AÁ]\s+(EXPEDIDO|LEVANTADO|CUMPRIDO)/.test(txt) ||
    /LEVANTAMENTO\s+(REALIZADO|EFETUADO|DE\s+VALORES)/.test(txt) ||
    /VALORES?\s+(RECEBIDOS?|LEVANTADOS?|CREDITADOS?)/.test(txt) ||
    /QUITA[CÇ][AÃ]O\s+(DO\s+D[EÉ]BITO|DA\s+OBRIGA)/.test(txt) ||
    /OBRIGA[CÇ][AÃ]O\s+SATISFEITA/.test(txt) ||
    /PAGAMENTO\s+(INTEGRAL|COMPROVADO|EFETUADO)/.test(txt) ||
    /CUMPRIMENTO\s+(INTEGRAL|SATISFEITO|HOMOLOGADO)/.test(txt) ||
    /EXTIN[CÇ][AÃ]O\s+PELO\s+PAGAMENTO/.test(txt)
  );
}

export function detectFlagsFase(c: LegalCase): FlagsFaseParado {
  const any = c as any;
  const txt = blobProcessual(c);
  const tipo = String(c.evento_tipo || '').toLowerCase();

  const temSentenca = !!(
    any.em_cumprimento_sentenca ||
    c.em_cumprimento_sentenca ||
    /sentenca_(procedente|improcedente|parcial)/.test(tipo) ||
    tipo === 'cumprimento_sentenca' ||
    any.is_procedente ||
    any.is_improcedente ||
    /\bSENTEN[CÇ]A\b/.test(txt) ||
    /\bJULGADO\b/.test(txt) ||
    /PROCED[EÊ]NCIA/.test(txt)
  );

  const temContestacao = !!(
    /contest/.test(tipo) ||
    /CONTESTA[CÇ][AÃ]O\s+(APRESENTAD|JUNTAD|OFERTAD|OFERECID|PROTOCOLAD|RECEBID|INTERPOST)/.test(txt) ||
    /JUNTAD[AO].{0,50}CONTESTA/.test(txt) ||
    /CONTESTA[CÇ][AÃ]O\s+(DA|DO)\s+R[EÉ]U/.test(txt) ||
    /\bCONTESTA[CÇ][AÃ]O\b/.test(txt) && !/PRAZO\s+(PARA\s+)?(A\s+)?CONTESTA/.test(txt)
  );

  const temReplica = !!(
    /replica/.test(tipo) ||
    /R[EÉ]PLICA\s+(APRESENTAD|JUNTAD|OFERTAD|OFERECID|PROTOCOLAD)/.test(txt) ||
    /JUNTAD[AO].{0,50}R[EÉ]PLICA/.test(txt) ||
    /MANIFESTA[CÇ][AÃ]O\s+SOBRE\s+A\s+CONTESTA/.test(txt) ||
    /\bR[EÉ]PLICA\b/.test(txt) && !/PRAZO\s+(PARA\s+)?(A\s+)?R[EÉ]PLICA/.test(txt)
  );

  const temCitacao = /\bCITA[CÇ][AÃ]O\b|CITADO|MANDADO\s+DE\s+CITA/.test(txt);
  const temAudiencia = /AUDI[EÊ]NCIA/.test(txt);
  const cumprimentoRecebido = isCumprimentoRecebido(c);
  const emCumpr =
    !!c.em_cumprimento_sentenca ||
    tipo === 'cumprimento_sentenca' ||
    !!(c as any).cumprimento_ativo ||
    !!(c as any).cumprimento_pendente_necessario;
  const cumprimentoAberto = !cumprimentoRecebido && (emCumpr || (temSentenca && ((c as any).is_procedente || tipo === 'sentenca_procedente')));
  const replicaPendente = temContestacao && !temReplica && !temSentenca;

  return {
    temContestacao,
    temSentenca,
    temReplica,
    cumprimentoRecebido,
    cumprimentoAberto,
    replicaPendente,
    temCitacao,
    temAudiencia,
  };
}

export type FiltroFaseParado =
  | 'sem_contestacao'
  | 'sem_sentenca'
  | 'sem_replica'
  | 'replica_pendente'
  | 'cumprimento_aberto'
  | 'janela_recente';

export function matchFiltrosFase(
  flags: FlagsFaseParado,
  ativos: FiltroFaseParado[],
  diasParado?: number
): boolean {
  if (!ativos.length) return true;
  for (const f of ativos) {
    if (f === 'sem_contestacao' && flags.temContestacao) return false;
    if (f === 'sem_sentenca' && flags.temSentenca) return false;
    if (f === 'sem_replica' && flags.temReplica) return false;
    if (f === 'replica_pendente' && !flags.replicaPendente) return false;
    if (f === 'cumprimento_aberto' && !flags.cumprimentoAberto) return false;
    if (f === 'janela_recente' && (diasParado == null || diasParado > 30)) return false;
  }
  return true;
}

export function isOnlyCustasSignal(c: LegalCase): boolean {
  const txt = textoProcessual(c);
  const hasCustas = /CUSTAS|TAXA JUDICIARIA|TAXA JUDICIÁRIA|GUIA GERADA|UFESP|RECOLHER\s+TAXA|PREPARO/.test(txt);
  if (!hasCustas) return false;
  const hasStrong =
    !!c.em_cumprimento_sentenca ||
    !!(c as any).cumprimento_pendente_necessario ||
    !!(c as any).cumprimento_ativo ||
    !!c.indicio_busca_apreensao ||
    (c as any).is_procedente === true ||
    c.evento_tipo === 'sentenca_procedente' ||
    c.evento_tipo === 'sentenca_improcedente' ||
    c.evento_tipo === 'cumprimento_sentenca' ||
    /CUMPRIMENTO|EMBARGOS|RECURSO|APELACAO|APELAÇÃO|BUSCA E APREEN|AUDIENCIA|AUDIÊNCIA|PENHORA/.test(txt);
  return !hasStrong;
}

export function aindaDaParaAgirNoProcesso(c: LegalCase): boolean {
  if (isCasoEncerrado(c)) return false;
  const sit = String(c.situacao || '').toUpperCase();
  if (sit === 'ARQUIVADO' || sit === 'ENCERRADO' || sit.includes('BAIXA DEFINITIVA')) return false;

  // Baixa no tribunal sem pendência residual → não listar como "ainda dá para agir"
  const txt = textoProcessual(c);
  const baixaForte =
    !!c.datajud_encerrado_tribunal ||
    /TRANSITO EM JULGADO|TRÂNSITO EM JULGADO|BAIXA DEFINITIVA|ARQUIVAMENTO DEFINITIVO/.test(txt);
  // Custas/guia sozinhas NÃO contam como residuo crítico:
  // processo com custas ainda pode tramitar normalmente e não é o foco da fila de parados.
  const temResiduo =
    !!c.em_cumprimento_sentenca ||
    !!(c as any).cumprimento_pendente_necessario ||
    !!(c as any).cumprimento_ativo ||
    /CUMPRIMENTO|EXECUCAO|EXECUÇÃO|HONORAR|EMBARGOS|RECURSO|APELACAO|APELAÇÃO/.test(txt) ||
    (c as any).is_procedente === true ||
    c.evento_tipo === 'sentenca_procedente' ||
    c.evento_tipo === 'cumprimento_sentenca' ||
    c.evento_tipo === 'sentenca_improcedente';

  if (baixaForte && !temResiduo) return false;
  if (isCumprimentoRecebido(c) && (baixaForte || /EXTIN[CÇ][AÃ]O|ARQUIV/.test(txt))) return false;
  return true;
}

/**
 * Oportunidades **processuais** (o que ainda se pode fazer no rito).
 * Evita priorizar só "ligar para o cliente".
 */
function oportunidadesDe(c: LegalCase, diasParado: number, estado: EstadoParado): string[] {
  const ops: string[] = [];
  const any = c as any;
  const txt = textoProcessual(c);

  if (estado === 'sem_scan') {
    ops.push('Auditar DataJud + DJEN para saber a fase real do processo');
    return ops;
  }

  // --- Mérito / execução ---
  const fase = detectFlagsFase(c);

  if (fase.cumprimentoRecebido) {
    // Já satisfeito — não empilhar ato de cumprimento
  } else if (c.em_cumprimento_sentenca || c.evento_tipo === 'cumprimento_sentenca' || any.cumprimento_ativo) {
    ops.push('Cumprimento em curso: conferir depósito, penhora, impugnação ou ato pendente');
  }

  if (fase.replicaPendente) {
    ops.push('Contestação nos autos: avaliar réplica ou manifestação no prazo');
  }
  if (fase.temCitacao && !fase.temContestacao && !fase.temSentenca) {
    ops.push('Citação sinalizada: conferir prazo de defesa e juntadas');
  }
  if (fase.temAudiencia) {
    ops.push('Audiência no histórico: confirmar pauta, acordo ou petição prévia');
  }
  if (fase.temContestacao && !fase.temReplica && diasParado >= 7 && diasParado < 45) {
    ops.push('Janela recente após defesa: conferir prazo de réplica/manifestação');
  }
  if (any.cumprimento_pendente_necessario || ((any.is_procedente || c.evento_tipo === 'sentenca_procedente') && !c.em_cumprimento_sentenca)) {
    ops.push('Sentença favorável: avaliar instauração ou andamento do cumprimento');
  }
  if (c.evento_tipo === 'sentenca_improcedente' || /IMPROCEDENTE/.test(txt)) {
    ops.push('Improcedência: avaliar embargos de declaração / recurso no prazo');
  }

  // Custas isoladas: sem relevância nesta fila (processo pode continuar no rito normal).
  // Justiça gratuita ainda é ato no processo (documentação / cumprimento de intimação).
  if (/GRATUIDADE|JUSTICA GRATUITA|JUSTIÇA GRATUITA|ASSISTENCIA JUDICIARIA/.test(txt)) {
    ops.push('Justiça gratuita: juntar documentos ou cumprir intimação no processo');
  }

  // --- Impulso quando o processo está parado de verdade ---
  if (diasParado >= 30 && !c.datajud_encerrado_tribunal) {
    ops.push('Petição de impulso / cobrança de andamento no próprio processo');
  }
  if (diasParado >= 90 && !c.datajud_encerrado_tribunal) {
    ops.push('Revisão da fase: saneamento, prova, conclusão ou recurso cabível');
  }

  // --- Riscos / defesa ---
  if (isBuscaApreensaoReal(c)) {
    ops.push('Risco possessório/BA: medida urgente no processo (defesa / informação ao juízo)');
  }
  if (/AUDIENCIA|AUDIÊNCIA/.test(txt) && !/REALIZADA|CANCELADA|REDESIGNADA/.test(txt)) {
    ops.push('Audiência: confirmar pauta e eventual petição prévia no processo');
  }
  if (/DOCUMENTO|JUNTADA|INTIMACAO|INTIMAÇÃO PARA/.test(txt) && diasParado >= 15) {
    ops.push('Intimação/documento: verificar se cabe resposta ou juntada no processo');
  }

  // --- Baixa residual ---
  if (c.datajud_encerrado_tribunal && !isCasoEncerrado(c)) {
    ops.push('Tribunal sinaliza baixa: conferir alvará, cumprimento residual ou ato útil no processo');
  }

  // Sem oportunidade processual clara → não inventar "só telefone"
  return ops;
}

/** Há ao menos uma providência no processo (não CRM genérico). */
export function temOportunidadeProcessual(c: LegalCase, diasParado: number, estado: EstadoParado): boolean {
  return oportunidadesDe(c, diasParado, estado).length > 0;
}

export function scoreAcaoParado(
  diasParado: number,
  diasSemRetorno: number | null,
  c: LegalCase,
  estado: EstadoParado
): number {
  if (estado === 'sem_scan') {
    return 90 + (diasSemRetorno != null ? Math.min(60, diasSemRetorno) : 30);
  }
  // Base: tempo **sem movimento no processo** (tribunal)
  let s = Math.min(420, Math.max(0, diasParado) * 2.2);
  const ops = oportunidadesDe(c, diasParado, estado);
  s += ops.length * 35;
  const faseS = detectFlagsFase(c);
  if (faseS.cumprimentoRecebido) s = Math.round(s * 0.25);
  else if (c.em_cumprimento_sentenca || (c as any).cumprimento_pendente_necessario) s += 80;
  if (faseS.replicaPendente) s += 55;
  if (faseS.cumprimentoAberto) s += 40;
  if (diasParado <= 30 && (faseS.replicaPendente || faseS.temCitacao)) s += 50;
  if ((c as any).is_procedente || c.evento_tipo === 'sentenca_procedente') s += 70;
  if (c.indicio_busca_apreensao) s += 90;
  if (c.datajud_encerrado_tribunal) s += 25; // residual, não prioridade máxima
  // Contato da equipe é secundário (não define "parado")
  if (diasSemRetorno != null && diasSemRetorno > 45) s += Math.min(40, diasSemRetorno / 3);
  if (estado === 'parado_provavel') s = Math.round(s * 0.7);
  return Math.round(s);
}

export interface ListParadosOpts {
  minDias?: number;
  /** Incluir casos sem scan (default true, mas em lista separável) */
  includeSemScan?: boolean;
  /** Só confirmados com data de tribunal */
  onlyConfirmados?: boolean;
  /**
   * Só processos em que ainda cabe providência no rito (default true).
   * Desligue só para auditoria técnica / inventário bruto.
   */
  onlyAcionaveis?: boolean;
  now?: Date;
  /** Default true — cumprimento já satisfeito/levantado sai da fila */
  excludeCumprimentoRecebido?: boolean;
  /** Default true — inclui fase viva mesmo com menos dias que minDias */
  includeJanelaRecente?: boolean;
}

/**
 * Lista processos **parados no tribunal** com possibilidade de ação no processo.
 * Critério de "parado": ausência de movimento útil (DataJud/DJEN/evento) ≥ minDias.
 * Critério de "acionável": aindaDaParaAgirNoProcesso + ao menos uma oportunidade processual.
 */
export function listProcessosParados(
  cases: LegalCase[],
  minDias: number = 60,
  opts: ListParadosOpts = {}
): ProcessoParadoItem[] {
  const now = opts.now || new Date();
  const includeSemScan = opts.includeSemScan !== false;
  const onlyConfirmados = !!opts.onlyConfirmados;
  const onlyAcionaveis = opts.onlyAcionaveis !== false;
  const out: ProcessoParadoItem[] = [];

  for (const c of cases || []) {
    if (isCasoEncerrado(c)) continue;
    if (String(c.situacao || '').toUpperCase() === 'ARQUIVADO') continue;
    if (onlyAcionaveis && !aindaDaParaAgirNoProcesso(c)) continue;
    if (onlyAcionaveis && isOnlyCustasSignal(c)) continue;

    const fasePre = detectFlagsFase(c);
    const excludeRecebido = opts.excludeCumprimentoRecebido !== false;
    if (excludeRecebido && fasePre.cumprimentoRecebido) continue;

    const ult = ultimaDataTribunal(c);
    const diasParado = diasDesde(ult.date, now);
    const includeRecente = opts.includeJanelaRecente !== false;
    const faseViva =
      fasePre.replicaPendente ||
      fasePre.cumprimentoAberto ||
      (fasePre.temCitacao && !fasePre.temContestacao && !fasePre.temSentenca) ||
      fasePre.temAudiencia;

    let estado: EstadoParado;
    if (!ult.temSinalTribunal) {
      estado = 'sem_scan';
    } else if (ult.fonte === 'datajud' || ult.fonte === 'djen' || ult.fonte === 'evento') {
      estado = 'parado_confirmado';
    } else {
      estado = 'parado_provavel';
    }

    if (estado === 'sem_scan') {
      if (!includeSemScan || onlyConfirmados) continue;
    } else {
      const dias = diasParado == null ? 0 : diasParado;
      const recenteComFase = includeRecente && faseViva && dias < minDias;
      if (dias < minDias && !recenteComFase) continue;
    }

    const retD = parseDateLoose(c.ultimoRetorno || (c as any).ultimo_retorno);
    const diasSemRetorno = diasDesde(retD, now);
    const diasForScore = estado === 'sem_scan' ? 0 : diasParado == null ? 0 : diasParado;
    const oportunidades = oportunidadesDe(c, diasForScore, estado);

    // Sem providência no processo → não entra na fila de parados acionáveis
    if (onlyAcionaveis && oportunidades.length === 0) continue;

    const fase = detectFlagsFase(c);
    out.push({
      case: c,
      estado,
      diasParadoTribunal: estado === 'sem_scan' ? 0 : diasParado == null ? 0 : diasParado,
      diasSemRetornoEquipe: diasSemRetorno,
      fonteData: ult.fonte,
      dataReferencia: ult.raw,
      ultimoSinalResumo: ult.resumo,
      oportunidades,
      scoreAcao: scoreAcaoParado(diasForScore, diasSemRetorno, c, estado),
      temContestacao: fase.temContestacao,
      temSentenca: fase.temSentenca,
      temReplica: fase.temReplica,
      cumprimentoRecebido: fase.cumprimentoRecebido,
      cumprimentoAberto: fase.cumprimentoAberto,
      replicaPendente: fase.replicaPendente,
    });
  }

  out.sort((a, b) => {
    // Confirmados primeiro por score; sem_scan depois (ou misturado por score)
    if (a.estado === 'sem_scan' && b.estado !== 'sem_scan') return 1;
    if (b.estado === 'sem_scan' && a.estado !== 'sem_scan') return -1;
    return b.scoreAcao - a.scoreAcao || b.diasParadoTribunal - a.diasParadoTribunal;
  });
  return out;
}

/** Contagem rápida para dashboard (parados confirmados ≥ minDias) */
export function countProcessosParados(cases: LegalCase[], minDias = 60): number {
  return listProcessosParados(cases, minDias, { includeSemScan: false, onlyConfirmados: true }).length;
}

export function countSemScanTribunal(cases: LegalCase[]): number {
  return listProcessosParados(cases, 0, { includeSemScan: true }).filter((i) => i.estado === 'sem_scan')
    .length;
}

/** Mensagens leigas por faixa / estado */
export function scriptProcessoParado(c: LegalCase, diasParado: number, estado?: EstadoParado): string {
  const nome = String(c.cliente || 'Cliente').split(/[/\-]/)[0].trim() || 'Cliente';
  const cnj = c.protocolo || '';

  if (estado === 'sem_scan') {
    return [
      `Olá, ${nome}! Tudo bem?`,
      ``,
      `Estamos atualizando a consulta oficial do processo nº ${cnj} junto ao tribunal.`,
      ``,
      `Assim que confirmarmos o andamento mais recente, te retorno com informações claras. Por enquanto você não precisa fazer nada.`,
      ``,
      `Qualquer dúvida, responda esta mensagem.`,
    ].join('\n');
  }

  const faixa =
    diasParado >= 180
      ? 'vários meses'
      : diasParado >= 90
        ? 'cerca de três meses ou mais'
        : diasParado >= 60
          ? 'cerca de dois meses'
          : 'algumas semanas';

  if (c.em_cumprimento_sentenca || c.evento_tipo === 'cumprimento_sentenca') {
    return [
      `Olá, ${nome}! Tudo bem?`,
      ``,
      `Sobre o processo nº ${cnj}: ele está em fase de cumprimento de sentença. Mesmo sem novidade recente no tribunal há ${faixa}, nossa equipe está conferindo se falta algum ato (guia, depósito ou petição) para avançar.`,
      ``,
      `Você não precisa providenciar nada até nossa orientação. Qualquer atualização objetiva, avisamos.`,
    ].join('\n');
  }

  if ((c as any).is_procedente || c.evento_tipo === 'sentenca_procedente') {
    return [
      `Olá, ${nome}! Tudo bem?`,
      ``,
      `Passando sobre o processo nº ${cnj}. Houve resultado favorável em algum momento e, pelos registros, o tribunal está sem movimentação nova há ${faixa}.`,
      ``,
      `Estamos revisando se o próximo passo é cumprimento, honorários ou outra providência. Em breve te retorno com o caminho certo — sem prometer prazo que o tribunal não controla.`,
      ``,
      `Qualquer dúvida, estou à disposição.`,
    ].join('\n');
  }

  if (diasParado >= 90) {
    return [
      `Olá, ${nome}! Tudo bem?`,
      ``,
      `Alinhando o processo nº ${cnj}: não há movimentação nova no tribunal há ${faixa}.`,
      ``,
      `Isso pode ocorrer em fases de espera, mas nossa equipe está avaliando se cabe um pedido de andamento ou outra medida adequada ao caso. Você não precisa agir agora.`,
      ``,
      `Quando tivermos a conclusão interna, te aviso com o próximo passo de forma simples.`,
    ].join('\n');
  }

  return [
    `Olá, ${nome}! Tudo bem?`,
    ``,
    `Passando para alinhar o andamento do processo nº ${cnj}.`,
    ``,
    `Pelos registros oficiais, o processo nº ${cnj} está sem movimentação nova no tribunal há ${faixa}. Nossa equipe está avaliando se ainda cabe alguma providência **dentro do próprio processo** (impulso, cumprimento ou recurso).`,
    ``,
    `Você não precisa fazer nada neste momento. Assim que houver orientação clara, te retorno.`,
    ``,
    `Qualquer dúvida, é só responder.`,
  ].join('\n');
}

/** localStorage keys */
export const PARADOS_TRATADOS_KEY = 'lexis_parados_tratados_v1';

export function loadTratadosMap(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(PARADOS_TRATADOS_KEY);
    if (!raw) return {};
    const j = JSON.parse(raw);
    return j && typeof j === 'object' ? j : {};
  } catch {
    return {};
  }
}

export function saveTratado(protocolo: string, isoDate?: string) {
  if (typeof window === 'undefined') return;
  const map = loadTratadosMap();
  map[String(protocolo)] = isoDate || new Date().toISOString().slice(0, 10);
  localStorage.setItem(PARADOS_TRATADOS_KEY, JSON.stringify(map));
}

export function clearTratado(protocolo: string) {
  if (typeof window === 'undefined') return;
  const map = loadTratadosMap();
  delete map[String(protocolo)];
  localStorage.setItem(PARADOS_TRATADOS_KEY, JSON.stringify(map));
}

/** True se ativo e parado confirmado ≥ minDias (sem incluir sem_scan). */
export function isCasoParadoTribunal(c: LegalCase, minDias = 60): boolean {
  if (isCasoEncerrado(c)) return false;
  const items = listProcessosParados([c], minDias, { includeSemScan: false, onlyConfirmados: true, onlyAcionaveis: true });
  return items.length > 0;
}

/** Dias parado confirmado ou null se não aplicável / sem_scan. */
export function getDiasParadoTribunal(c: LegalCase, minDias = 60): number | null {
  if (isCasoEncerrado(c)) return null;
  const items = listProcessosParados([c], minDias, { includeSemScan: false, onlyConfirmados: true, onlyAcionaveis: true });
  if (!items.length) return null;
  return items[0].diasParadoTribunal;
}
