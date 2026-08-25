/**
 * Política de encerramento no scanner (lote operacional).
 *
 * - AUTO: baixa tribunal + improcedente + sem CS/BA/procedente → encerra gabinete
 * - REVISÃO: há valor residual → NÃO some da fila; prioridade na fila de contato + Encerrados a revisar
 * - Nunca altera created_by (dono)
 */

export type DecisaoEncerrarScan =
  | { acao: 'auto_encerrar'; motivo: string }
  | { acao: 'revisao_fila'; motivo: string; prioridade: number }
  | { acao: 'nenhuma' };

function truthy(v: unknown): boolean {
  return !!v;
}

export function decidirEncerramentoScan(ctx: {
  target: any;
  patch: Record<string, any>;
}): DecisaoEncerrarScan {
  const t = ctx.target || {};
  const p = ctx.patch || {};
  const d = (t.dados && typeof t.dados === 'object' ? t.dados : {}) as any;

  const baixaTribunal = truthy(
    p.datajud_encerrado_tribunal ?? t.datajud_encerrado_tribunal
  );
  if (!baixaTribunal) return { acao: 'nenhuma' };

  const procedente = truthy(
    p.is_procedente ?? t.is_procedente ?? d.is_procedente
  );
  const parcial =
    p.merito_resultado === 'parcial' ||
    truthy(p.sentenca_parcial ?? t.sentenca_parcial) ||
    String(p.procedente_motivo || t.procedente_motivo || '').toUpperCase().includes('PARCIAL');
  const cumprimento = truthy(
    p.em_cumprimento_sentenca ??
      t.em_cumprimento_sentenca ??
      p.cumprimento_ativo ??
      t.cumprimento_ativo ??
      p.cumprimento_pendente_necessario ??
      t.cumprimento_pendente_necessario
  );
  const ba = truthy(p.indicio_busca_apreensao ?? t.indicio_busca_apreensao);
  const oportunidade = truthy(
    p.oportunidade_elegivel ?? t.oportunidade_elegivel ?? d.oportunidade_elegivel
  );
  const improcedente =
    p.merito_resultado === 'improcedente' ||
    truthy(t.merito_resultado === 'improcedente') ||
    /IMPROCEDENTE/.test(
      String(p.procedente_motivo || t.procedente_motivo || p.datajud_encerrado_motivo || t.datajud_encerrado_motivo || '').toUpperCase()
    );

  // Valor residual → fila de contato prioridade + revisar encerrados
  if (procedente || parcial || cumprimento || ba || oportunidade) {
    let prioridade = 70;
    if (ba) prioridade = 95;
    else if (cumprimento) prioridade = 90;
    else if (procedente || parcial) prioridade = 85;
    else if (oportunidade) prioridade = 80;
    const bits: string[] = [];
    if (ba) bits.push('B.A.');
    if (cumprimento) bits.push('cumprimento');
    if (procedente) bits.push('procedente');
    if (parcial) bits.push('parcial');
    if (oportunidade) bits.push('oportunidade');
    return {
      acao: 'revisao_fila',
      motivo: `Baixa no tribunal com sinal residual (${bits.join(', ')}) — manter na fila`,
      prioridade,
    };
  }

  // Seguro: baixa + (improcedente OU sem sinal de mérito positivo)
  if (improcedente || (!procedente && !parcial && !cumprimento && !ba)) {
    return {
      acao: 'auto_encerrar',
      motivo:
        p.datajud_encerrado_motivo ||
        t.datajud_encerrado_motivo ||
        'Baixa no tribunal sem valor residual — auto gabinete',
    };
  }

  return { acao: 'nenhuma' };
}

/**
 * Aplica decisão no patch do scanner.
 * Nunca inclui created_by / atendido_por (não rouba dono nem KPI de operador).
 */
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
    out.situacao = 'ENCERRADO';
    out.status = 'Arquivado';
    out.statusManual = 'Encerrado';
    out.proximoPrazo = '';
    out.proximo_retorno = null;
    out.diasFaltando = null;
    out.precisa_revisar_encerramento = false;
    out.prioridade_revisao_encerrado = 0;
    out.via_scan_auto_encerrar = true;
    out.datajud_encerrado_tribunal = true;
    dadosBase.situacao = 'ENCERRADO';
    dadosBase.statusManual = 'Encerrado';
    dadosBase.status = 'Arquivado';
    dadosBase.proximoPrazo = '';
    dadosBase.diasFaltando = null;
    dadosBase.via_scan_auto_encerrar = true;
    dadosBase.scan_auto_encerrar_motivo = decisao.motivo;
    dadosBase.precisa_revisar_encerramento = false;
    // limpa flag de prioridade de revisão
    delete dadosBase.prioridade_revisao_encerrado;
  } else if (decisao.acao === 'revisao_fila') {
    // NÃO encerra gabinete — mantém ativo na fila de contato
    out.precisa_revisar_encerramento = true;
    out.prioridade_revisao_encerrado = decisao.prioridade;
    out.tem_novo_andamento = true; // sobe na fila
    out.evento_tipo = out.evento_tipo || 'REVISAR_ENCERRAMENTO';
    out.evento_resumo =
      out.evento_resumo ||
      decisao.motivo ||
      'Baixa no tribunal — revisar (valor residual)';
    dadosBase.precisa_revisar_encerramento = true;
    dadosBase.prioridade_revisao_encerrado = decisao.prioridade;
    dadosBase.scan_revisao_motivo = decisao.motivo;
    // força aparecer em Encerrados a revisar mesmo se gabinete ainda "EM ANDAMENTO"
    dadosBase.baixa_tribunal_pendente_revisao = true;
  }

  out.dados = dadosBase;
  // hard guard: nunca dono / atendimento
  delete out.created_by;
  delete out.atendido_por;
  delete out.auditado_por;
  return out;
}
