/**
 * Governança de status inativos / baixas tribunal.
 * Lê situacao, statusManual, status_interno, via_scan_auto_encerrar e dados.*.
 */
export const STATUS_ENCERRADOS = [
  'ENCERRADO',
  'ARQUIVADO',
  'EXTINTO',
  'SUSPENSO',
  'IMOVEL',
  'IMÓVEL',
  'BAIXA DEFINITIVA',
  'ARQUIVAMENTO',
];

export function isAguardandoProtocoloTribunal(texto: string): boolean {
  const t = String(texto || '').toUpperCase();
  if (!t) return false;
  return (
    /AGUARD\.?\s*PROTOCOLO/.test(t) ||
    /PROTOCOLO\s*DO\s*TJ/.test(t) ||
    /AGUARD\.PROTOCOLODO/.test(t)
  );
}

function hasStrongEncerrado(s: string): boolean {
  const u = String(s || '').toUpperCase();
  if (!u) return false;
  if (/\bENCERRAD[OA]\b/.test(u) || u.includes('ENCERRADO') || u.includes('ENCERRADA')) return true;
  if (u.includes('ARQUIVADO') || u.includes('ARQUIVAMENTO')) return true;
  if (u.includes('EXTINTO') || u.includes('EXTINÇÃO') || u.includes('EXTINCAO')) return true;
  if (u.includes('SUSPENSO')) return true;
  if (u.includes('BAIXA DEFINITIVA')) return true;
  if (u.includes('IMOVEL') || u.includes('IMÓVEL')) return true;
  if (u.includes('FINALIZADO') || u.includes('FINALIZADA')) return true;
  return false;
}

/**
 * Caso inativo para filas / KPIs de carteira ativa.
 */
export function isCasoEncerrado(c: any): boolean {
  if (!c) return false;
  const d = c.dados && typeof c.dados === 'object' ? c.dados : {};

  // Scanner auto / W1
  if (c.via_scan_auto_encerrar || d.via_scan_auto_encerrar) return true;
  if (c.operacao_sistema?.tipo === 'SCAN_AUTO_ENCERRAR' || d.operacao_sistema?.tipo === 'SCAN_AUTO_ENCERRAR') {
    return true;
  }

  const situ = String(
    c.situacao || d.situacao || c.status_interno || d.status_interno || d.SITUACAO || ''
  ).toUpperCase();
  const manual = String(c.statusManual || d.statusManual || d.STATUS_MANUAL || '').toUpperCase();
  const status = String(c.status || d.status || '').toUpperCase();
  const blob = `${status} ${situ} ${manual} ${c.status_interno || ''} ${d.status_interno || ''}`.trim();

  if (hasStrongEncerrado(situ) || hasStrongEncerrado(manual)) return true;
  if (hasStrongEncerrado(String(c.status_interno || d.status_interno || ''))) return true;

  // status de prazo NÃO encerra sozinho (Vencido etc.)
  const prazoOnly = [
    'VENCIDO', 'É HOJE', 'E HOJE', 'ATENÇÃO', 'ATENCAO', 'NO PRAZO', 'SEM PRAZO',
    'CASO CRÍTICO', 'CASO CRITICO', 'AUTOMATICO', 'AUTOMÁTICO',
  ];
  if (hasStrongEncerrado(status) && !prazoOnly.includes(status)) return true;

  if (isAguardandoProtocoloTribunal(blob) && !hasStrongEncerrado(blob)) return false;

  return STATUS_ENCERRADOS.some((x) => blob.includes(x));
}

export function isBaixaTribunal(c: any): boolean {
  if (!c) return false;
  const dados = c.dados && typeof c.dados === 'object' ? c.dados : {};
  const blob = `${c.status || ''} ${c.situacao || ''} ${c.evento_resumo || ''} ${dados.situacao || ''}`.toUpperCase();

  if (isAguardandoProtocoloTribunal(blob) && !hasStrongEncerrado(blob)) return false;

  const emCump =
    !!(c.em_cumprimento_sentenca ||
      c.cumprimento_ativo ||
      c.cumprimento_pendente_necessario ||
      dados.em_cumprimento_sentenca);

  // Cumprimento ativo: não tratar como "só baixa" para some KPIs
  if (emCump && !isCasoEncerrado(c)) {
    // ainda pode ser baixa do principal — flag column
  }

  if (c.datajud_encerrado_tribunal || dados.datajud_encerrado_tribunal) {
    if (emCump && !isCasoEncerrado(c)) return false;
    return true;
  }

  if (/TR[AÂ]NSITO|BAIXA\s+DEFINITIVA|ARQUIVAMENTO\s+DEFINITIVO/.test(blob)) {
    if (emCump && !isCasoEncerrado(c)) return false;
    return true;
  }
  return false;
}
