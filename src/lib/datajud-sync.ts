/**
 * @fileOverview Motor de Sincronia e Comparação de Datas DataJud v3.2
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import { startOfDay, parseISO, isAfter, subDays, parse, isValid } from 'date-fns';
import { scoreOportunidadeCumprimentoHonorarios, type OportunidadeInstaurarCumprimento } from './oportunidade-cumprimento';

export function gerarHashAuditoria(movimentos: any[]): string {
  if (!movimentos || movimentos.length === 0) return "EMPTY";
  
  const sorted = [...movimentos].sort((a, b) => 
    new Date(b.dataHora || 0).getTime() - new Date(a.dataHora || 0).getTime()
  );

  const signature = sorted.slice(0, 3)
    .map(m => `${m.dataHora || ''}|${m.nome || ''}`)
    .join('##');

  try {
    if (typeof btoa !== 'undefined') {
      return btoa(unescape(encodeURIComponent(signature))).substring(0, 32);
    }
    return Buffer.from(signature).toString('base64').substring(0, 32);
  } catch {
    return signature.substring(0, 32);
  }
}

export function detectarEncerradoNoTribunal(movimentos: any[]): {
  encerrado: boolean;
  motivo: string | null;
} {
  if (!movimentos || movimentos.length === 0) {
    return { encerrado: false, motivo: null };
  }

  const sorted = [...movimentos].sort((a, b) => 
    new Date(b.dataHora || 0).getTime() - new Date(a.dataHora || 0).getTime()
  );
  
  const window = sorted.slice(0, 25);

  const patternGroups = [
    {
      patterns: ['BAIXA DEFINITIVA', 'BAIXA DO PROCESSO', 'BAIXA DEFINITIVA DO FEITO', 'PROCESSO BAIXADO', 'DETERMINADA A BAIXA'],
      label: 'BAIXA DEFINITIVA'
    },
    {
      patterns: ['TRÂNSITO EM JULGADO', 'TRANSITO EM JULGADO', 'CERTIFICADA A TRANSITO', 'CERTIFICADO O TRÂNSITO'],
      label: 'TRÂNSITO EM JULGADO'
    },
    {
      patterns: ['EXTINTO O PROCESSO', 'PROCESSO EXTINTO', 'SENTENÇA DE EXTINÇÃO', 'EXTINÇÃO DO PROCESSO', 'JULGO EXTINTO'],
      label: 'EXTINÇÃO DO PROCESSO'
    },
    {
      patterns: ['ARQUIVAMENTO DEFINITIVO', 'ARQUIVADO DEFINITIVAMENTE', 'ARQUIVEM-SE OS AUTOS', 'AUTOS ARQUIVADOS'],
      label: 'ARQUIVAMENTO DEFINITIVO'
    },
    {
      patterns: ['CANCELADA A DISTRIBUIÇÃO', 'CANCELAMENTO DA DISTRIBUIÇÃO', 'DISTRIBUIÇÃO CANCELADA'],
      label: 'CANCELAMENTO DA DISTRIBUIÇÃO'
    }
  ];

  const constructedWindow = window.map(mov => {
    return `${mov.nome || ''} ${mov.complemento || ''} ${mov.descricao || ''}`.toUpperCase();
  });

  // Movimentos mais recentes que REABREM fase operacional (ex.: cumprimento após trânsito)
  const ACTIVE_AFTER = [
    'CUMPRIMENTO DE SENTENÇA',
    'INÍCIO DE CUMPRIMENTO',
    'PEDIDO DE INÍCIO DE CUMPRIMENTO',
    'REGULARIZAR SEU PEDIDO',
    'ART. 524',
    'ARTIGO 524',
    'PETIÇÃO',
    'DESPACHO',
    'INTIMAÇÃO',
    'ATO ORDINATÓRIO',
    'CONCLUSÃO PARA DESPACHO',
    'EXPEDIÇÃO DE DOCUMENTO',
  ];

  // Encontra índice do fechamento e de atividade posterior
  let closeIdx = -1;
  let closeLabel: string | null = null;
  let closeStrong = false;
  for (let i = 0; i < constructedWindow.length; i++) {
    const text = constructedWindow[i];
    for (const group of patternGroups) {
      if (group.patterns.some((p) => text.includes(p))) {
        closeIdx = i;
        closeLabel = group.label;
        closeStrong = group.label === 'BAIXA DEFINITIVA' || group.label === 'ARQUIVAMENTO DEFINITIVO' || group.label === 'CANCELAMENTO DA DISTRIBUIÇÃO';
        break;
      }
    }
    if (closeIdx >= 0) break;
  }
  if (closeIdx < 0) return { encerrado: false, motivo: null };

  // Atividade mais recente que o "fecho"?
  for (let i = 0; i < closeIdx; i++) {
    const text = constructedWindow[i];
    if (ACTIVE_AFTER.some((p) => text.includes(p))) {
      // Trânsito/baixa antigos + cumprimento/petição depois = processo ATIVO
      return { encerrado: false, motivo: null };
    }
  }

  // Trânsito isolado sem baixa definitiva: só marca se não houver fase ativa na janela
  if (!closeStrong && closeLabel === 'TRÂNSITO EM JULGADO') {
    const anyActive = constructedWindow.some((text) =>
      ACTIVE_AFTER.some((p) => text.includes(p))
    );
    if (anyActive) return { encerrado: false, motivo: null };
  }

  return { encerrado: true, motivo: closeLabel };
}

/**
 * Cumprimento de sentença ATIVO — janela 25 movimentos.
 * Não marca se já houver encerramento definitivo na mesma análise (feito no audit).
 */
export function detectarCumprimentoSentenca(movimentos: any[]): {
  ativo: boolean;
  motivo: string | null;
} {
  if (!movimentos || movimentos.length === 0) {
    return { ativo: false, motivo: null };
  }

  const sorted = [...movimentos].sort((a, b) => 
    new Date(b.dataHora || 0).getTime() - new Date(a.dataHora || 0).getTime()
  );

  const window = sorted.slice(0, 25);
  const allText = window.map(m => 
    `${m.nome || ''} ${m.complemento || ''} ${m.descricao || ''}`.toUpperCase()
  ).join(' || ');

  const patterns = [
    'CUMPRIMENTO DE SENTENÇA',
    'CUMPRIMENTO DE SENTENCA',
    'EXECUÇÃO/CUMPRIMENTO DE SENTENÇA',
    'EXECUCAO/CUMPRIMENTO DE SENTENCA',
    'EXECUÇÃO/CUMPRIMENTO DE SENTENÇA INICIADA',
    'EXECUCAO/CUMPRIMENTO DE SENTENCA INICIADA',
    'CUMPRIMENTO DE SENTENÇA INICIADA',
    'CUMPRIMENTO DE SENTENCA INICIADA',
    'CUMPRIMENTO PROVISÓRIO DE SENTENÇA',
    'CUMPRIMENTO PROVISORIO DE SENTENCA',
    'CUMPRIMENTO PROVISÓRIO',
    'CUMPRIMENTO PROVISORIO',
    'CUMPRIMENTO DEFINITIVO',
    'FASE DE CUMPRIMENTO',
    'INÍCIO DO CUMPRIMENTO',
    'INICIO DO CUMPRIMENTO',
    'INICIO DO CUMPRIMENTO DE SENTENCA',
    'EXECUÇÃO DE SENTENÇA',
    'EXECUCAO DE SENTENCA',
    'EXECUÇÃO PROVISÓRIA',
    'EXECUCAO PROVISORIA',
    'PROCEDIMENTO DE CUMPRIMENTO',
    'CUMPRIMENTO DE SENTENÇA PROVISÓRIO',
    'REQ. DE CUMPRIMENTO',
    'REQUERIMENTO DE CUMPRIMENTO',
    'PETIÇÃO DE CUMPRIMENTO',
    'PETICAO DE CUMPRIMENTO',
    'INÍCIO DE CUMPRIMENTO',
    'INICIO DE CUMPRIMENTO',
  ];

  for (const p of patterns) {
    if (allText.includes(p)) {
      return { ativo: true, motivo: p };
    }
  }

  // Fallback: "CUMPRIMENTO" + "SENTEN" no mesmo movimento
  for (const m of window) {
    const t = `${m.nome || ''} ${m.complemento || ''} ${m.descricao || ''}`.toUpperCase();
    if (t.includes('CUMPRIMENTO') && (t.includes('SENTEN') || t.includes('EXECU'))) {
      return { ativo: true, motivo: 'CUMPRIMENTO (heurística)' };
    }
  }

  return { ativo: false, motivo: null };
}



/** Usa só o último nome salvo (coluna) quando não há lista de movimentos — backfill / UI. */
export function detectarCumprimentoFromNome(ultimoNome: string | null | undefined): {
  ativo: boolean;
  motivo: string | null;
} {
  if (!ultimoNome) return { ativo: false, motivo: null };
  const U = String(ultimoNome).toUpperCase();
  const patterns = [
    'CUMPRIMENTO DE SENTEN',
    'EXECUÇÃO/CUMPRIMENTO',
    'EXECUCAO/CUMPRIMENTO',
    'FASE DE CUMPRIMENTO',
    'INÍCIO DO CUMPRIMENTO',
    'INICIO DO CUMPRIMENTO',
    'EXECUÇÃO DE SENTEN',
    'EXECUCAO DE SENTEN',
    'CUMPRIMENTO PROVIS',
  ];
  for (const p of patterns) {
    if (U.includes(p)) return { ativo: true, motivo: p };
  }
  if (U.includes('CUMPRIMENTO') && (U.includes('SENTEN') || U.includes('EXECU'))) {
    return { ativo: true, motivo: 'CUMPRIMENTO (nome)' };
  }
  return { ativo: false, motivo: null };
}

/** Sentença de mérito a partir de movimentos (janela 25). */
export function detectarSentencaMerito(movimentos: any[]): {
  tipo: 'procedente' | 'improcedente' | 'parcial' | null;
  motivo: string | null;
} {
  if (!movimentos?.length) return { tipo: null, motivo: null };
  const sorted = [...movimentos].sort(
    (a, b) => new Date(b.dataHora || 0).getTime() - new Date(a.dataHora || 0).getTime()
  );
  const window = sorted.slice(0, 25);
  const texts = window.map(
    (m) => `${m.nome || ''} ${m.complemento || ''} ${m.descricao || ''}`.toUpperCase()
  );
  for (const t of texts) {
    if (t.includes('PARCIALMENTE PROCEDENTE') || t.includes('PROCEDENTE EM PARTE')) {
      return { tipo: 'parcial', motivo: 'PARCIALMENTE PROCEDENTE' };
    }
  }
  for (const t of texts) {
    if (
      t.includes('JULGADO PROCEDENTE') ||
      t.includes('JULGADA PROCEDENTE') ||
      (t.includes('PROCEDENTE') && !t.includes('IMPROCEDENTE') && !t.includes('PARCIAL'))
    ) {
      return { tipo: 'procedente', motivo: 'PROCEDENTE' };
    }
  }
  for (const t of texts) {
    if (t.includes('IMPROCEDENTE') || t.includes('JULGO IMPROCEDENTE')) {
      return { tipo: 'improcedente', motivo: 'IMPROCEDENTE' };
    }
  }
  return { tipo: null, motivo: null };
}

/**
 * Análise unificada de Procedência + Cumprimento de Sentença + Pendência Omitida.
 * Combina detecção TPU de movimentos, classes e trânsito em julgado.
 */
export function analisarProcedenciaECumprimento(
  movimentos: any[],
  classeCodigo?: number | null,
  ultimoNome?: string | null,
  djenTextos?: string[] | null
): {
  is_procedente: boolean;
  procedente_motivo: string | null;
  /** Fase de cumprimento instaurada (ativa OU já existiu). */
  em_cumprimento_sentenca: boolean;
  /** Cumprimento ainda em curso (não satisfeito/extinto). */
  cumprimento_ativo: boolean;
  /** Cumprimento já quitado/extinto/arquivado na fase executiva. */
  cumprimento_encerrado: boolean;
  /** Procedente + trânsito + sem instauração da fase 156. */
  cumprimento_pendente_necessario: boolean;
  data_transito_julgado: string | null;
  merito_tipo: 'procedente' | 'parcial' | 'improcedente' | null;
  /**
   * pendente = falta instaurar
   * ativo = cumprimento em andamento
   * encerrado = cumprimento satisfeito/extinto
   * procedente = procedente sem fase executiva ainda definida
   * nenhum = fora do módulo
   */
  status_executivo:
    | 'pendente'
    | 'ativo'
    | 'encerrado'
    | 'procedente'
    | 'nenhum';
  detalhes_execucao: {
    motivos: string[];
    classeCodigo?: number | null;
    diasAposTransito?: number | null;
    fonte: string[];
    principal_extinto_ignorado?: boolean;
    confianca?: number;
    declaratorio_sem_quantia?: boolean;
    ativo_forte?: boolean;
    transito_fonte?: string | null;
  };
  /** Camada comercial: elegível para instaurar + score de honorários */
  oportunidade_instaurar?: OportunidadeInstaurarCumprimento;
} {
  const CODIGOS_PROCEDENCIA = [219, 221, 12223, 12329, 12330, 237, 238, 50094, 12185];
  const CLASSES_CUMPRIMENTO = [156, 157, 12078, 12231, 12246, 15159, 1111];
  const CODIGO_TRANSITO = 848;
  const motivos: string[] = [];
  const fontes: string[] = [];
  const djenBlob = (djenTextos || []).join(' || ').toUpperCase();

  const ENCERRAMENTO_CUMPRIMENTO = [
    'EXTINÇÃO DO CUMPRIMENTO',
    'EXTINCAO DO CUMPRIMENTO',
    'CUMPRIMENTO EXTINTO',
    'EXTINTO O CUMPRIMENTO',
    'SATISFAÇÃO DA OBRIGAÇÃO',
    'SATISFACAO DA OBRIGACAO',
    'OBRIGAÇÃO SATISFEITA',
    'OBRIGACAO SATISFEITA',
    'QUITAÇÃO DO DÉBITO',
    'QUITACAO DO DEBITO',
    'QUITADO O DÉBITO',
    'ALVARÁ DE LEVANTAMENTO',
    'ALVARA DE LEVANTAMENTO',
    'LEVANTAMENTO DE VALORES',
    'ARQUIVAMENTO DO CUMPRIMENTO',
    'BAIXA DO CUMPRIMENTO',
    'CUMPRIMENTO DE SENTENÇA EXTINTO',
    'ACORDO CUMPRIDO',
    'ACORDO INTEGRALMENTE CUMPRIDO',
  ];
  const HOMOLOG_ACORDO = ['HOMOLOGAÇÃO DE ACORDO', 'HOMOLOGACAO DE ACORDO'];

  const INICIO_CUMPRIMENTO = [
    'CUMPRIMENTO DE SENTENÇA',
    'CUMPRIMENTO DE SENTENCA',
    'CUMPRIMENTO PROVISÓRIO',
    'CUMPRIMENTO PROVISORIO',
    'FASE DE CUMPRIMENTO',
    'INÍCIO DO CUMPRIMENTO',
    'INICIO DO CUMPRIMENTO',
    'REQUERIMENTO DE CUMPRIMENTO',
    'PETIÇÃO DE CUMPRIMENTO',
    'PETICAO DE CUMPRIMENTO',
    'EXECUÇÃO DE SENTENÇA',
    'EXECUCAO DE SENTENCA',
    'EXECUÇÃO/CUMPRIMENTO',
    'EXECUCAO/CUMPRIMENTO',
  ];

  function textOf(m: any) {
    return `${m?.nome || ''} ${m?.complemento || ''} ${m?.descricao || ''}`.toUpperCase();
  }

  const movs = Array.isArray(movimentos) ? movimentos : [];
  const sorted = [...movs].sort(
    (a, b) => new Date(b.dataHora || 0).getTime() - new Date(a.dataHora || 0).getTime()
  );
  const window25 = sorted.slice(0, 80);
  const allText =
    window25.map(textOf).join(' || ') +
    ' || ' +
    String(ultimoNome || '').toUpperCase() +
    ' || ' +
    djenBlob;
  const blob = allText;

  // --- Procedência ---
  let isProcedente = false;
  let procedenteMotivo: string | null = null;
  let merito: 'procedente' | 'parcial' | 'improcedente' | null = null;

  for (const mov of window25) {
    const cod = Number(mov.codigo || mov.tipoCodigo || 0);
    if (CODIGOS_PROCEDENCIA.includes(cod)) {
      isProcedente = true;
      procedenteMotivo = mov.nome || `TPU ${cod}`;
      merito = cod === 221 || cod === 12330 || cod === 238 ? 'parcial' : 'procedente';
      motivos.push(`TPU ${cod}`);
      fontes.push('datajud-tpu');
      break;
    }
  }
  if (!isProcedente && movs.length) {
    const sentenca = detectarSentencaMerito(movs);
    if (sentenca.tipo === 'procedente' || sentenca.tipo === 'parcial') {
      isProcedente = true;
      procedenteMotivo = sentenca.motivo || sentenca.tipo;
      merito = sentenca.tipo === 'parcial' ? 'parcial' : 'procedente';
      motivos.push(`texto: ${procedenteMotivo}`);
      fontes.push('datajud-texto');
    }
  }
  if (!isProcedente && djenBlob) {
    if (
      djenBlob.includes('PARCIALMENTE PROCEDENTE') ||
      djenBlob.includes('PROCEDENTE EM PARTE')
    ) {
      isProcedente = true;
      merito = 'parcial';
      procedenteMotivo = 'DJEN parcial';
      motivos.push('DJEN: parcial');
      fontes.push('djen');
    } else if (
      (djenBlob.includes('JULGO PROCEDENTE') ||
        djenBlob.includes('JULGADO PROCEDENTE') ||
        djenBlob.includes('ACOLHO OS PEDIDOS')) &&
      !djenBlob.includes('IMPROCEDENTE')
    ) {
      isProcedente = true;
      merito = 'procedente';
      procedenteMotivo = 'DJEN procedente';
      motivos.push('DJEN: procedente');
      fontes.push('djen');
    }
  }
  if (!isProcedente && blob.includes('IMPROCEDENTE')) {
    merito = 'improcedente';
  }

  // --- Cumprimento instaurado (classe OU texto) ---
  let emCumprimento = CLASSES_CUMPRIMENTO.includes(Number(classeCodigo || 0));
  if (emCumprimento) {
    motivos.push(`classe ${classeCodigo}`);
    fontes.push('datajud-classe');
  }
  if (!emCumprimento) {
    const cs = detectarCumprimentoSentenca(movs);
    if (cs.ativo) {
      emCumprimento = true;
      motivos.push(cs.motivo || 'cumprimento movimento');
      fontes.push('datajud-texto');
    }
  }
  if (!emCumprimento) {
    for (const p of INICIO_CUMPRIMENTO) {
      if (blob.includes(p)) {
        emCumprimento = true;
        motivos.push(`texto: ${p}`);
        fontes.push(djenBlob.includes(p) ? 'djen' : 'datajud-texto');
        break;
      }
    }
  }
  // nome isolado
  if (!emCumprimento) {
    const cn = detectarCumprimentoFromNome(ultimoNome);
    if (cn.ativo) {
      emCumprimento = true;
      motivos.push(cn.motivo || 'nome');
      fontes.push('nome');
    }
  }

  // Baixa do PROCESSO PRINCIPAL sozinha não cria cumprimento
  const baixaPrincipalOnly =
    /BAIXA DEFINITIVA|ARQUIVAMENTO DEFINITIVO/.test(blob) &&
    !/CUMPRIMENTO\s+DE\s+SENTEN|FASE DE CUMPRIMENTO|EXECU[CÇ][AÃ]O DE SENTEN|CLASSE.*156/.test(
      blob
    );
  if (baixaPrincipalOnly && !CLASSES_CUMPRIMENTO.includes(Number(classeCodigo || 0))) {
    // não remove se já detectou cumprimento real acima com keywords fortes
    const hasCumpKw = INICIO_CUMPRIMENTO.some((p) => blob.includes(p));
    if (!hasCumpKw) {
      emCumprimento = false;
      motivos.push('veto: baixa do principal sem cumprimento');
    }
  }

  // --- Cumprimento ENCERRADO (fase executiva satisfeita) — independente do principal ---
  let cumprimentoEncerrado = false;
  for (const p of ENCERRAMENTO_CUMPRIMENTO) {
    if (blob.includes(p)) {
      // Se fala em cumprimento + extinção/satisfação, ou acordo quitado na fase
      if (
        emCumprimento ||
        blob.includes('CUMPRIMENTO') ||
        p.includes('SATISFA') ||
        p.includes('QUIT') ||
        p.includes('LEVANTAMENTO')
      ) {
        cumprimentoEncerrado = true;
        motivos.push(`encerrado: ${p}`);
        fontes.push('texto-encerramento');
        break;
      }
    }
  }
  // Se classe ainda é 156 e não há extinção, permanece ativo
  if (emCumprimento && cumprimentoEncerrado) {
    // ainda "em cumprimento" no sentido de "passou pela fase", mas status = encerrado
  }

  // Homologação de acordo só encerra se já havia fase de cumprimento
  if (!cumprimentoEncerrado) {
    for (const p of HOMOLOG_ACORDO) {
      if (
        blob.includes(p) &&
        (emCumprimento || /CUMPRIMENTO|EXECU[CÇ][AÃ]O DE SENTEN|FASE EXECUT/.test(blob))
      ) {
        cumprimentoEncerrado = true;
        motivos.push(`encerrado: ${p} (com fase de cumprimento)`);
        fontes.push('homolog-acordo-cump');
        break;
      }
    }
  }

  // --- Trânsito confiável (TPU 848 > texto movimento > certidão DJEN) ---
  let dataTransito: string | null = null;
  let transitoFonte: string | null = null;
  for (const mov of window25) {
    const cod = Number(mov.codigo || mov.tipoCodigo || 0);
    if (cod === CODIGO_TRANSITO) {
      dataTransito = mov.dataHora || null;
      transitoFonte = 'tpu-848';
      fontes.push('transito-tpu');
      break;
    }
  }
  if (!dataTransito) {
    for (const m of window25) {
      const tx = textOf(m);
      if (
        tx.includes('TRÂNSITO EM JULGADO') ||
        tx.includes('TRANSITO EM JULGADO') ||
        tx.includes('CERTIDÃO DE TRÂNSITO') ||
        tx.includes('CERTIDAO DE TRANSITO')
      ) {
        dataTransito = m.dataHora || null;
        transitoFonte = 'texto-movimento';
        fontes.push('transito-texto');
        break;
      }
    }
  }
  if (!dataTransito && djenBlob) {
    if (/TR[AÂ]NSITO EM JULGADO|CERTID[AÃ]O DE TR[AÂ]NSITO|TRANSITO EM JULGADO/.test(djenBlob)) {
      dataTransito = new Date().toISOString();
      transitoFonte = 'djen-certidao';
      fontes.push('transito-djen');
      motivos.push('trânsito detectado no DJEN (certidão/publicação)');
    }
  }

  const art523 =
    /ART\.?\s*523|PAGAMENTO VOLUNT[AÁ]RIO|15 DIAS PARA CUMPRIMENTO|MULTA DE 10%/.test(blob);
  const decursoSem =
    /DECORRIDO O PRAZO SEM|SEM PAGAMENTO VOLUNT|SEM EFETIVA[CÇ][AÃ]O DO DEP[OÓ]SITO/.test(blob);

  // Procedente só declaratório / inexigibilidade sem condenação em quantia
  const declaratorioSemQuantia =
    isProcedente &&
    /INEXIGIBILIDADE|DECLAR[OÓ]\s+A\s+INEXIST|DECLARAT[OÓ]RIA|MERO\s+DECLAR|SEM\s+CONDENA[CÇ][AÃ]O/.test(
      blob
    ) &&
    !/CONDENO\s+A\s+PAGAR|PAGAR\s+O\s+VALOR|OBRIGAÇÃO\s+DE\s+PAGAR|OBRIGACAO\s+DE\s+PAGAR|R\$\s*\d/.test(
      blob
    );
  if (declaratorioSemQuantia) {
    motivos.push('procedente declaratório/inexigibilidade — sem quantia típica');
    fontes.push('excecao-declaratorio');
  }

  // Sinais fortes de cumprimento ATIVO
  const ativoForte =
    emCumprimento &&
    /PENHORA|SISBAJUD|BACENJUD|RENAJUD|BLOQUEIO\s+DE\s+VALOR|C[AÁ]LCULOS?\s+DE\s+LIQUIDA|IMPUGNA[CÇ][AÃ]O\s+AOS\s+C[AÁ]LCULOS|HASTA\s+P[UÚ]BLICA|LEIL[AÃ]O|EXPROPRIA|RPV|PRECAT[OÓ]RIO/.test(
      blob
    );
  if (ativoForte) {
    motivos.push('ativo forte: penhora/Sisbajud/cálculos/RPV');
    fontes.push('ativo-forte');
  }

  let diasApos: number | null = null;
  if (dataTransito && transitoFonte !== 'djen-certidao') {
    const dataT = new Date(dataTransito);
    if (!Number.isNaN(dataT.getTime())) {
      diasApos = Math.floor((Date.now() - dataT.getTime()) / (1000 * 3600 * 24));
    }
  }

  // Pendente exige trânsito confiável (não marca só com art.523 sem trânsito)
  let cumprimentoPendente = false;
  const temTransitoConfiavel = !!transitoFonte;
  if (
    isProcedente &&
    !emCumprimento &&
    !cumprimentoEncerrado &&
    !declaratorioSemQuantia
  ) {
    if (temTransitoConfiavel && diasApos != null && diasApos > 15) {
      cumprimentoPendente = true;
      motivos.push(`pendente: ${diasApos}d após trânsito (${transitoFonte}) sem fase 156`);
      fontes.push('regra-pendente-transito');
    } else if (temTransitoConfiavel && transitoFonte === 'djen-certidao' && art523) {
      cumprimentoPendente = true;
      motivos.push('pendente: trânsito DJEN + art.523 sem fase 156');
      fontes.push('regra-pendente-djen');
    } else if (art523 && decursoSem && temTransitoConfiavel) {
      cumprimentoPendente = true;
      motivos.push('pendente: art.523 + decurso após trânsito');
      fontes.push('regra-pendente-523');
    } else if (art523 && decursoSem && !temTransitoConfiavel) {
      motivos.push('art.523+decurso sem trânsito formal — não marca pendente');
      fontes.push('pendente-rejeitado-sem-transito');
    }
  }

    // Lote3: nunca pendente + em cumprimento ao mesmo tempo
  if (emCumprimento || cumprimentoEncerrado) {
    cumprimentoPendente = false;
  }
  const cumprimentoAtivo = emCumprimento && !cumprimentoEncerrado;

  let status_executivo: 'pendente' | 'ativo' | 'encerrado' | 'procedente' | 'nenhum' =
    'nenhum';
  // Ordem: ativo/encerrado antes de pendente (evita foco errado na aba)
  if (cumprimentoAtivo) status_executivo = 'ativo';
  else if (cumprimentoEncerrado && (emCumprimento || isProcedente))
    status_executivo = 'encerrado';
  else if (cumprimentoPendente) status_executivo = 'pendente';
  else if (isProcedente) status_executivo = 'procedente';

  // Confiança 0–100: TPU/classe > DJEN > heurística
  let confianca = 40;
  if (fontes.includes('datajud-tpu')) confianca += 25;
  if (CLASSES_CUMPRIMENTO.includes(Number(classeCodigo || 0))) confianca += 20;
  if (transitoFonte === 'tpu-848') confianca += 15;
  else if (transitoFonte === 'texto-movimento') confianca += 10;
  else if (transitoFonte === 'djen-certidao') confianca += 8;
  if (ativoForte) confianca += 10;
  if (fontes.includes('texto-encerramento') || fontes.includes('homolog-acordo-cump')) confianca += 5;
  if (declaratorioSemQuantia) confianca = Math.min(confianca, 55);
  confianca = Math.max(0, Math.min(100, confianca));

  // Importante: principal extinto NÃO apaga cumprimento.
  // Se houve fase 156, em_cumprimento_sentenca permanece true para a aba.
  const oportunidade_instaurar: OportunidadeInstaurarCumprimento = scoreOportunidadeCumprimentoHonorarios({
    is_procedente: isProcedente,
    merito_tipo: merito,
    cumprimento_pendente_necessario: cumprimentoPendente,
    em_cumprimento_sentenca: emCumprimento || cumprimentoEncerrado,
    cumprimento_encerrado: cumprimentoEncerrado,
    cumprimento_ativo: cumprimentoAtivo,
    confianca,
    dias_apos_transito: diasApos,
    transito_fonte: transitoFonte,
    declaratorio_sem_quantia: declaratorioSemQuantia,
    ativo_forte: ativoForte,
    blob,
  });
  if (oportunidade_instaurar.elegivel) {
    motivos.push(`oportunidade score ${oportunidade_instaurar.score} · ${oportunidade_instaurar.tipo_credito}`);
  }

  return {
    is_procedente: isProcedente,
    procedente_motivo: procedenteMotivo,
    em_cumprimento_sentenca: emCumprimento || cumprimentoEncerrado,
    cumprimento_ativo: cumprimentoAtivo,
    cumprimento_encerrado: cumprimentoEncerrado,
    cumprimento_pendente_necessario: cumprimentoPendente,
    data_transito_julgado: dataTransito,
    merito_tipo: merito,
    status_executivo,
    oportunidade_instaurar,
    detalhes_execucao: {
      motivos,
      classeCodigo: classeCodigo ?? null,
      diasAposTransito: diasApos,
      fonte: [...new Set(fontes)],
      principal_extinto_ignorado: true,
      confianca,
      declaratorio_sem_quantia: declaratorioSemQuantia,
      ativo_forte: ativoForte,
      transito_fonte: transitoFonte,
    },
  };
}

export function detectarAtualizacaoPosRetorno(
  ultimoRetornoStr: string | null | undefined,
  movimentos: any[]
): { alerta: boolean; dataUltimo: string | null; nomeUltimo: string | null } {
  if (!movimentos || movimentos.length === 0) {
    return { alerta: false, dataUltimo: null, nomeUltimo: null };
  }

  const sorted = [...movimentos].sort((a, b) => 
    new Date(b.dataHora || 0).getTime() - new Date(a.dataHora || 0).getTime()
  );
  
  const lastMov = sorted[0];
  const dataMov = lastMov.dataHora ? parseISO(lastMov.dataHora) : null;
  
  if (!dataMov) return { alerta: false, dataUltimo: null, nomeUltimo: lastMov.nome || null };

  const dataUltimoStr = dataMov.toISOString();
  const nomeUltimo = lastMov.nome || "Movimentação não identificada";

  if (!ultimoRetornoStr || ultimoRetornoStr.trim() === "" || ultimoRetornoStr === "-" || ultimoRetornoStr === "0") {
    const quarentaECincoDias = startOfDay(subDays(new Date(), 45));
    return {
      alerta: isAfter(dataMov, quarentaECincoDias),
      dataUltimo: dataUltimoStr,
      nomeUltimo
    };
  }

  try {
    let dataRetorno;
    const cleanStr = ultimoRetornoStr.trim();
    if (cleanStr.includes('-')) {
      dataRetorno = parseISO(cleanStr);
    } else if (cleanStr.includes('/')) {
      dataRetorno = parse(cleanStr, 'dd/MM/yyyy', new Date());
    }

    if (dataRetorno && isValid(dataRetorno)) {
      const fimDoDiaRetorno = new Date(dataRetorno);
      fimDoDiaRetorno.setHours(23, 59, 59, 999);

      return {
        alerta: isAfter(dataMov, fimDoDiaRetorno),
        dataUltimo: dataUltimoStr,
        nomeUltimo
      };
    }
    return { alerta: false, dataUltimo: dataUltimoStr, nomeUltimo };
  } catch (e) {
    return { alerta: false, dataUltimo: dataUltimoStr, nomeUltimo };
  }
}