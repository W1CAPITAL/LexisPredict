/**
 * Encerramento automático no scanner — política CONSERVADORA.
 *
 * SÓ auto-encerra se:
 *   1) baixa/trânsito no tribunal (datajud_encerrado_tribunal)
 *   2) sinal explícito de IMPROCEDENTE (ou extinção sem mérito útil)
 *   3) SEM procedente / parcial
 *   4) SEM cumprimento ativo, encerrado-fase ou pendente de instaurar
 *   5) SEM indício B.A.
 *   6) SEM oportunidade de honorários elegível
 *
 * Qualquer dúvida → REVISÃO (fica na fila de contato + Encerrados a revisar).
 * Nunca mexe em created_by / atendido_por.
 *
 * Desligar: SCAN_AUTO_ENCERRAR=0 no ambiente Vercel.
 */

export type DecisaoEncerrarScan =
  | { acao: 'auto_encerrar'; motivo: string }
  | { acao: 'revisao_fila'; motivo: string; prioridade: number }
  | { acao: 'nenhuma' };

function on(): boolean {
  const v = String(process.env.SCAN_AUTO_ENCERRAR ?? '1').trim().toLowerCase();
  return v !== '0' && v !== 'false' && v !== 'off' && v !== 'no';
}

function truthy(v: unknown): boolean {
  return !!v;
}

function blob(...parts: unknown[]): string {
  return parts.map((p) => String(p || '')).join(' ').toUpperCase();
}

export function decidirEncerramentoScan(ctx: {
  target: any;
  patch: Record<string, any>;
}): DecisaoEncerrarScan {
  if (!on()) return { acao: 'nenhuma' };

  const t = ctx.target || {};
  const p = ctx.patch || {};
  const d = (t.dados && typeof t.dados === 'object' ? t.dados : {}) as any;

  const baixaTribunal = truthy(
    p.datajud_encerrado_tribunal ?? t.datajud_encerrado_tribunal
  );
  if (!baixaTribunal) return { acao: 'nenhuma' };

  const text = blob(
    p.procedente_motivo,
    t.procedente_motivo,
    p.datajud_encerrado_motivo,
    t.datajud_encerrado_motivo,
    p.evento_resumo,
    t.evento_resumo,
    p.merito_resultado,
    t.merito_resultado,
    d.procedente_motivo
  );

  const procedente = truthy(p.is_procedente ?? t.is_procedente ?? d.is_procedente) ||
    /PROCEDENTE(?!\s*EM\s*PARTE)/.test(text) && !/IMPROCEDENTE/.test(text);
  // parcial explícito
  const parcial =
    p.merito_resultado === 'parcial' ||
    truthy(p.sentenca_parcial ?? t.sentenca_parcial) ||
    /PARCIALMENTE\s+PROCEDENTE|PROCEDENTE\s+EM\s+PARTE|PROVIMENTO\s+EM\s+PARTE/.test(text);
  const cumprimento = truthy(
    p.em_cumprimento_sentenca ??
      t.em_cumprimento_sentenca ??
      p.cumprimento_ativo ??
      t.cumprimento_ativo ??
      p.cumprimento_pendente_necessario ??
      t.cumprimento_pendente_necessario ??
      d.em_cumprimento_sentenca
  );
  const ba = truthy(p.indicio_busca_apreensao ?? t.indicio_busca_apreensao);
  const oportunidade = truthy(
    p.oportunidade_elegivel ?? t.oportunidade_elegivel ?? d.oportunidade_elegivel
  );

  const improcedente =
    p.merito_resultado === 'improcedente' ||
    t.merito_resultado === 'improcedente' ||
    /IMPROCEDENTE/.test(text);

  const extincaoSemMeritoUtil =
    /EXTIN[CÇ][AÃ]O|CANCELAMENTO\s+DA\s+DISTRIBUI[CÇ][AÃ]O|BAIXA\s+DEFINITIVA|ARQUIVAMENTO\s+DEFINITIVO/.test(
      text
    ) && !procedente && !parcial && !cumprimento;

  // ——— residual: NÃO auto-encerra ———
  if (procedente || parcial || cumprimento || ba || oportunidade) {
    let prioridade = 70;
    const bits: string[] = [];
    if (ba) {
      prioridade = 95;
      bits.push('B.A.');
    }
    if (cumprimento) {
      prioridade = Math.max(prioridade, 90);
      bits.push('cumprimento');
    }
    if (procedente) {
      prioridade = Math.max(prioridade, 88);
      bits.push('procedente');
    }
    if (parcial) {
      prioridade = Math.max(prioridade, 85);
      bits.push('parcial');
    }
    if (oportunidade) {
      prioridade = Math.max(prioridade, 80);
      bits.push('oportunidade');
    }
    return {
      acao: 'revisao_fila',
      motivo: `Baixa no tribunal + residual (${bits.join(', ')}) — fila de contato + Encerrados a revisar`,
      prioridade,
    };
  }

  // ——— AUTO só com improcedente explícito OU extinção limpa ———
  if (improcedente || extincaoSemMeritoUtil) {
    return {
      acao: 'auto_encerrar',
      motivo:
        (improcedente
          ? 'Improcedente + baixa tribunal'
          : 'Extinção/baixa definitiva sem residual') +
        (p.datajud_encerrado_motivo || t.datajud_encerrado_motivo
          ? ` · ${p.datajud_encerrado_motivo || t.datajud_encerrado_motivo}`
          : ''),
    };
  }

  // Baixa tribunal sem classificação de mérito → revisão (não fecha no escuro)
  return {
    acao: 'revisao_fila',
    motivo: 'Baixa no tribunal sem mérito claro — revisar antes de arquivar',
    prioridade: 72,
  };
}

export function aplicarDecisaoNoPatch(
  patch: Record<string, any>,
  target: any,
  decisao: DecisaoEncerrarScan
): Record<string, any> {
  const out = { ...patch };
  const dadosBase =
    out.dados && typeof out.dados === 'object'
      ? { ...out.dados }
      : target?.dados && typeof target.dados === 'object'
        ? { ...target.dados }
        : {};

  if (decisao.acao === 'auto_encerrar') {
    const nowIso = new Date().toISOString();
    const nowBr = new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).slice(0, 10);
    out.situacao = 'ENCERRADO';
    out.status = 'Arquivado';
    out.statusManual = 'Encerrado';
    out.diasFaltando = null;
    out.precisa_revisar_encerramento = false;
    out.prioridade_revisao_encerrado = 0;
    out.via_scan_auto_encerrar = true;
    out.datajud_encerrado_tribunal = true;
    out.scan_auto_encerrado_em = nowIso;
    out.scan_auto_encerrado_dia = nowBr;
    // Contabilização W1 CONTROL (não é atendimento de operador)
    out.operacao_sistema = {
      origem: 'W1_CONTROL',
      perfil: 'W1 CONTROL',
      tipo: 'SCAN_AUTO_ENCERRAR',
      legenda: 'Feito por Davi Alves Figueredo · scanner automático',
    };
    out.auditado_por_nome = 'W1 CONTROL';
    out.auditado_legenda = 'Feito por Davi Alves Figueredo · scanner automático';
    dadosBase.situacao = 'ENCERRADO';
    dadosBase.statusManual = 'Encerrado';
    dadosBase.status = 'Arquivado';
    dadosBase.proximoPrazo = '';
    dadosBase.diasFaltando = null;
    dadosBase.via_scan_auto_encerrar = true;
    dadosBase.scan_auto_encerrar_motivo = decisao.motivo;
    dadosBase.scan_auto_encerrado_em = nowIso;
    dadosBase.scan_auto_encerrado_dia = nowBr;
    dadosBase.precisa_revisar_encerramento = false;
    dadosBase.operacao_sistema = out.operacao_sistema;
    dadosBase.auditado_por_nome = 'W1 CONTROL';
    dadosBase.auditado_legenda = 'Feito por Davi Alves Figueredo · scanner automático';
    delete dadosBase.prioridade_revisao_encerrado;
    delete dadosBase.baixa_tribunal_pendente_revisao;
  } else if (decisao.acao === 'revisao_fila') {
    out.precisa_revisar_encerramento = true;
    out.prioridade_revisao_encerrado = decisao.prioridade;
    out.tem_novo_andamento = true;
    out.evento_tipo = out.evento_tipo || 'REVISAR_ENCERRAMENTO';
    out.evento_resumo = out.evento_resumo || decisao.motivo;
    dadosBase.precisa_revisar_encerramento = true;
    dadosBase.prioridade_revisao_encerrado = decisao.prioridade;
    dadosBase.scan_revisao_motivo = decisao.motivo;
    dadosBase.baixa_tribunal_pendente_revisao = true;
  }

  out.dados = dadosBase;
  delete out.created_by;
  delete out.atendido_por;
  delete out.auditado_por;
  return out;
}
