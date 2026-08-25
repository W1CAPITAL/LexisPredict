/**
 * Governança de status inativos / baixas tribunal.
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
  if (/\bENCERRAD[OA]\b/.test(u) || u.includes('ENCERRADO') || u.includes('ENCERRADA')) return true;
  if (u.includes('ARQUIVADO') || u.includes('ARQUIVAMENTO')) return true;
  if (u.includes('EXTINTO') || u.includes('EXTINÇÃO') || u.includes('EXTINCAO')) return true;
  if (u.includes('SUSPENSO')) return true;
  if (u.includes('BAIXA DEFINITIVA')) return true;
  if (u.includes('IMOVEL') || u.includes('IMÓVEL')) return true;
  return false;
}

/**
 * Caso inativo para filas / KPIs de carteira ativa.
 * AGUARD.PROTOCOLO sozinho NÃO encerra; ENCERRADO/ARQUIVADO sim, mesmo se o texto misturar AGUARD.
 */
export function isCasoEncerrado(c: any): boolean {
  if (!c) return false;
  const situ = String(c.situacao || c.dados?.situacao || '').toUpperCase();
  const manual = String(c.statusManual || '').toUpperCase();
  const status = String(c.status || c.dados?.status || '').toUpperCase();
  const blob = `${status} ${situ} ${manual}`.trim();

  // Forte: encerrado/arquivado explícito → sempre true
  if (hasStrongEncerrado(situ) || hasStrongEncerrado(manual)) return true;
  if (hasStrongEncerrado(status) && !['VENCIDO', 'É HOJE', 'E HOJE', 'ATENÇÃO', 'ATENCAO', 'NO PRAZO', 'SEM PRAZO', 'CASO CRÍTICO', 'CASO CRITICO'].includes(status)) {
    return true;
  }

  // Só AGUARD.PROTOCOLO (sem ENCERRADO/ARQUIVADO) → ativo
  if (isAguardandoProtocoloTribunal(blob) && !hasStrongEncerrado(blob)) return false;

  return STATUS_ENCERRADOS.some((x) => blob.includes(x));
}

export function isBaixaTribunal(c: any): boolean {
  if (!c) return false;
  const dados = c.dados && typeof c.dados === 'object' ? c.dados : {};
  const blob = `${c.status || ''} ${c.situacao || ''} ${c.evento_resumo || ''} ${dados.situacao || ''}`.toUpperCase();

  // AGUARD sozinho não é baixa
  if (isAguardandoProtocoloTribunal(blob) && !hasStrongEncerrado(blob)) return false;

  const emCump =
    !!(c.em_cumprimento_sentenca || dados.em_cumprimento_sentenca) &&
    !(c.cumprimento_encerrado || dados.cumprimento_encerrado);
  const cumpAtivo = !!(c.cumprimento_ativo || dados.cumprimento_ativo || emCump);
  if (cumpAtivo) return false;

  if (c.datajud_encerrado_tribunal === true || dados.datajud_encerrado_tribunal === true) return true;
  const ev = String(c.evento_tipo || dados.evento_tipo || '');
  if (ev === 'transito_ou_baixa' || ev === 'transito_baixa') return true;
  return false;
}

export function countEncerradosCarteira(cases: any[]): number {
  return (cases || []).filter(isCasoEncerrado).length;
}
export function countBaixasTribunal(cases: any[]): number {
  return (cases || []).filter(isBaixaTribunal).length;
}
export function countAtivosCarteira(cases: any[]): number {
  return (cases || []).filter((c) => !isCasoEncerrado(c)).length;
}
