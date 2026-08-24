/**
 * @fileOverview Governança de Status Inativos
 * Define quem NÃO entra em filas de atendimento / KPIs de carteira ativa.
 *
 * DUAS MÉTRICAS DISTINTAS (nunca misturar nos KPIs):
 * - isCasoEncerrado → "Encerrado na carteira" (status/situação operacional)
 * - isBaixaTribunal → "Baixa no tribunal" (telemetria DataJud/DJEN)
 *
 * O scanner pode marcar datajud_encerrado_tribunal enquanto o caso continua
 * ATIVO na carteira (ex.: trânsito + cumprimento). Por isso os números diferem.
 */

export const STATUS_ENCERRADOS = [
  'ENCERRADO',
  'ARQUIVADO',
  'EXTINTO',
  'SUSPENSO',
  'IMOVEL',
  'IMÓVEL',
];

/** "Aguardando protocolo do TJ…" NÃO é baixa/encerramento real. */
export function isAguardandoProtocoloTribunal(texto: string): boolean {
  const t = String(texto || '').toUpperCase();
  if (!t) return false;
  return (
    /AGUARD\.?\s*PROTOCOLO/.test(t) ||
    /PROTOCOLO\s*DO\s*TJ/.test(t) ||
    /AGUARD\.PROTOCOLODO/.test(t)
  );
}

/**
 * Caso inativo para filas e KPIs de carteira ativa.
 * Baseado em status textual operacional (não só em flags de telemetria).
 */
export function isCasoEncerrado(c: any): boolean {
  if (!c) return false;
  const s = `${c.status || ''} ${c.situacao || ''} ${c.statusManual || ''} ${c.dados?.situacao || ''} ${c.dados?.status || ''}`.toUpperCase();

  // Falso positivo clássico: Encerrou · AGUARD.PROTOCOLODOTJPR
  if (isAguardandoProtocoloTribunal(s)) return false;

  // Só encerra com palavra-chave forte de carteira
  return STATUS_ENCERRADOS.some((x) => {
    if (x === 'ENCERRADO') {
      // "ENCERRADO" / "ENCERRADA" — não "ENCERROU" sozinho de audit chip
      return /\bENCERRAD[OA]\b/.test(s) || s.includes('ENCERRADO') || s.includes('ENCERRADA');
    }
    return s.includes(x);
  });
}

/**
 * Indica baixa/trânsito detectado no tribunal (telemetria).
 * Usar para KPI "Baixas no tribunal" — NÃO para tirar da carteira ativa.
 */
export function isBaixaTribunal(c: any): boolean {
  if (!c) return false;
  const dados = c.dados && typeof c.dados === 'object' ? c.dados : {};
  const blob = `${c.status || ''} ${c.situacao || ''} ${c.evento_resumo || ''} ${dados.situacao || ''}`.toUpperCase();
  if (isAguardandoProtocoloTribunal(blob)) return false;

  const emCump =
    !!(c.em_cumprimento_sentenca || dados.em_cumprimento_sentenca) &&
    !(c.cumprimento_encerrado || dados.cumprimento_encerrado);
  const cumpAtivo = !!(c.cumprimento_ativo || dados.cumprimento_ativo || emCump);

  if (cumpAtivo) return false;

  if (c.datajud_encerrado_tribunal === true || dados.datajud_encerrado_tribunal === true) {
    return true;
  }
  const ev = String(c.evento_tipo || dados.evento_tipo || '');
  if (ev === 'transito_ou_baixa' || ev === 'transito_baixa') {
    const evBlob = `${c.evento_resumo || ''} ${c.datajud_ultimo_nome || ''} ${c.djen_ultimo_resumo || ''} ${dados.evento_resumo || ''}`.toUpperCase();
    if (isAguardandoProtocoloTribunal(evBlob)) return false;
    return true;
  }
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
