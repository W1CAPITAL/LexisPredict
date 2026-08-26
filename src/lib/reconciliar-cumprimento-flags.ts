/**
 * Resolve conflito: pendente instaurar × já em cumprimento.
 * Regra: se há fase de cumprimento ativa ou encerrada, NÃO pode permanecer "pendente instaurar".
 */

export type FlagsCumprimento = {
  cumprimento_pendente_necessario?: boolean | null;
  em_cumprimento_sentenca?: boolean | null;
  cumprimento_ativo?: boolean | null;
  cumprimento_encerrado?: boolean | null;
  status_executivo?: string | null;
  is_procedente?: boolean | null;
  dados?: Record<string, any> | null;
};

export type FlagsCumprimentoResolved = {
  cumprimento_pendente_necessario: boolean;
  em_cumprimento_sentenca: boolean;
  cumprimento_ativo: boolean;
  cumprimento_encerrado: boolean;
  status_executivo: 'pendente' | 'ativo' | 'encerrado' | 'procedente' | 'nenhum';
  conflito_resolvido: boolean;
  motivo_resolucao: string | null;
};

function truthy(...vals: any[]): boolean {
  return vals.some((v) => v === true || v === 'true' || v === 1);
}

/**
 * Lê flags espalhadas (coluna + dados JSON) e devolve estado coerente.
 */
export function reconciliarFlagsCumprimento(input: FlagsCumprimento): FlagsCumprimentoResolved {
  const d = input.dados && typeof input.dados === 'object' ? input.dados : {};

  let em = truthy(
    input.em_cumprimento_sentenca,
    d.em_cumprimento_sentenca,
    input.cumprimento_ativo,
    d.cumprimento_ativo
  );
  let encerrado = truthy(input.cumprimento_encerrado, d.cumprimento_encerrado);
  let pendente = truthy(input.cumprimento_pendente_necessario, d.cumprimento_pendente_necessario);
  const procedente = truthy(input.is_procedente, d.is_procedente);

  // Encerrado implica "já houve/foi cumprimento" no radar operacional
  if (encerrado) {
    em = true;
  }

  let conflito = false;
  let motivo: string | null = null;

  // Conflito clássico: pendente + já em fase
  if (pendente && (em || encerrado)) {
    conflito = true;
    pendente = false;
    motivo = encerrado
      ? 'Conflito: pendente removido — cumprimento já encerrado/satisfeito'
      : 'Conflito: pendente removido — já em cumprimento de sentença';
  }

  // Ativo = em cumprimento e não encerrado
  const ativo = em && !encerrado;

  let status: FlagsCumprimentoResolved['status_executivo'] = 'nenhum';
  if (pendente) status = 'pendente';
  else if (ativo) status = 'ativo';
  else if (encerrado) status = 'encerrado';
  else if (procedente) status = 'procedente';

  // status_executivo salvo inconsistente
  const stRaw = String(input.status_executivo || d.status_executivo || '').toLowerCase();
  if (stRaw === 'pendente' && (ativo || encerrado)) {
    conflito = true;
    motivo = motivo || 'status_executivo pendente sobrescrito por fase ativa/encerrada';
  }

  return {
    cumprimento_pendente_necessario: pendente,
    em_cumprimento_sentenca: em,
    cumprimento_ativo: ativo,
    cumprimento_encerrado: encerrado,
    status_executivo: status,
    conflito_resolvido: conflito,
    motivo_resolucao: motivo,
  };
}

/** Aplica resolução em um casePatch antes de gravar. */
export function applyReconciliacaoAoPatch(patch: Record<string, any>, target?: Record<string, any>): Record<string, any> {
  const merged = {
    cumprimento_pendente_necessario:
      patch.cumprimento_pendente_necessario ?? target?.cumprimento_pendente_necessario,
    em_cumprimento_sentenca: patch.em_cumprimento_sentenca ?? target?.em_cumprimento_sentenca,
    cumprimento_ativo: patch.cumprimento_ativo ?? target?.cumprimento_ativo,
    cumprimento_encerrado: patch.cumprimento_encerrado ?? target?.cumprimento_encerrado,
    status_executivo: patch.status_executivo ?? target?.status_executivo,
    is_procedente: patch.is_procedente ?? target?.is_procedente,
    dados: {
      ...(typeof target?.dados === 'object' && target?.dados ? target.dados : {}),
      ...(typeof patch.dados === 'object' && patch.dados ? patch.dados : {}),
    },
  };
  const r = reconciliarFlagsCumprimento(merged);
  return {
    ...patch,
    cumprimento_pendente_necessario: r.cumprimento_pendente_necessario,
    em_cumprimento_sentenca: r.em_cumprimento_sentenca,
    cumprimento_ativo: r.cumprimento_ativo,
    cumprimento_encerrado: r.cumprimento_encerrado,
    status_executivo: r.status_executivo,
    // zera elegibilidade de instaurar se já ativo
    ...(r.cumprimento_ativo || r.cumprimento_encerrado
      ? {
          oportunidade_elegivel: false,
        }
      : {}),
    detalhes_execucao: {
      ...(typeof patch.detalhes_execucao === 'object' && patch.detalhes_execucao
        ? patch.detalhes_execucao
        : {}),
      status_executivo: r.status_executivo,
      cumprimento_ativo: r.cumprimento_ativo,
      cumprimento_encerrado: r.cumprimento_encerrado,
      flags_conflito_resolvido: r.conflito_resolvido,
      flags_conflito_motivo: r.motivo_resolucao,
    },
  };
}
