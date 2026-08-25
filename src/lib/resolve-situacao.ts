/**
 * Resolve situacao operacional (gabinete) a partir de colunas + JSON.
 * Nunca usa status de prazo (Vencido/No Prazo) como situacao.
 */
const STRONG = /ENCERRAD|ARQUIVAD|EXTINT|BAIXA\s*DEFINITIVA|FINALIZAD|SUSPENS/;

export function resolveSituacaoFromRow(item: any, dados?: any): string {
  const d = dados && typeof dados === 'object'
    ? dados
    : (item?.dados && typeof item.dados === 'object' ? item.dados : {});

  if (d.via_scan_auto_encerrar || item?.via_scan_auto_encerrar) return 'ENCERRADO';
  if (d.operacao_sistema?.tipo === 'SCAN_AUTO_ENCERRAR') return 'ENCERRADO';

  const candidates = [
    d.situacao,
    d.SITUACAO,
    item?.status_interno,
    d.status_interno,
    d.statusManual,
    d.STATUS_MANUAL,
    // coluna status só se for forte (Arquivado/Encerrado), nunca Vencido
    item?.status,
    d.status,
  ];

  for (const c of candidates) {
    const u = String(c || '').toUpperCase().trim();
    if (!u) continue;
    if (STRONG.test(u)) {
      if (/ARQUIV/.test(u)) return 'ENCERRADO';
      if (/ENCERRAD/.test(u)) return 'ENCERRADO';
      if (/EXTINT/.test(u)) return 'EXTINTO';
      if (/SUSPENS/.test(u)) return 'SUSPENSO';
      if (/FINALIZ/.test(u)) return 'ENCERRADO';
      return u;
    }
  }

  const fallback = String(d.situacao || d.SITUACAO || 'EM ANDAMENTO').toUpperCase().trim();
  // se fallback for status de prazo, força EM ANDAMENTO
  if (/^(VENCIDO|É HOJE|E HOJE|ATENÇÃO|ATENCAO|NO PRAZO|SEM PRAZO|CASO CR[IÍ]TICO)$/.test(fallback)) {
    return 'EM ANDAMENTO';
  }
  return fallback || 'EM ANDAMENTO';
}

export function resolveStatusManualFromRow(item: any, dados?: any, situacao?: string): string {
  const d = dados && typeof dados === 'object'
    ? dados
    : (item?.dados && typeof item.dados === 'object' ? item.dados : {});
  const sit = String(situacao || resolveSituacaoFromRow(item, d)).toUpperCase();
  let manual = String(d.statusManual || d.STATUS_MANUAL || 'Automatico');
  if (STRONG.test(sit)) {
    if (/automatico/i.test(manual) || /vencido|é hoje|atenção|no prazo|sem prazo/i.test(manual)) {
      manual = /ARQUIV/.test(sit) ? 'Arquivado' : 'Encerrado';
    }
  }
  return manual;
}
