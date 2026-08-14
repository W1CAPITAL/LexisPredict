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

/**
 * Caso inativo para filas e KPIs de carteira ativa.
 * Baseado apenas em status textual operacional (não em flags de telemetria).
 */
export function isCasoEncerrado(c: any): boolean {
  if (!c) return false;
  const s = `${c.status || ''} ${c.situacao || ''} ${c.statusManual || ''} ${c.dados?.situacao || ''} ${c.dados?.status || ''}`.toUpperCase();
  return STATUS_ENCERRADOS.some((x) => s.includes(x));
}

/**
 * Indica baixa/trânsito detectado no tribunal (telemetria).
 * Usar para KPI "Baixas no tribunal" — NÃO para tirar da carteira ativa.
 *
 * Regras estáveis (não oscilar com cumprimento genérico):
 * - datajud_encerrado_tribunal === true conta, EXCETO se cumprimento ativo claro
 * - evento transito_ou_baixa conta se não houver fase de cumprimento ativa
 */
export function isBaixaTribunal(c: any): boolean {
  if (!c) return false;
  const dados = c.dados && typeof c.dados === 'object' ? c.dados : {};
  const emCump =
    !!(c.em_cumprimento_sentenca || dados.em_cumprimento_sentenca) &&
    !(c.cumprimento_encerrado || dados.cumprimento_encerrado);
  const cumpAtivo = !!(c.cumprimento_ativo || dados.cumprimento_ativo || emCump);

  // Cumprimento ATIVO: processo principal pode ter "trânsito", mas não é "baixa morta"
  if (cumpAtivo) return false;

  if (c.datajud_encerrado_tribunal === true || dados.datajud_encerrado_tribunal === true) {
    return true;
  }
  const ev = String(c.evento_tipo || dados.evento_tipo || '');
  if (ev === 'transito_ou_baixa' || ev === 'transito_baixa') {
    const blob = `${c.evento_resumo || ''} ${c.datajud_ultimo_nome || ''} ${c.djen_ultimo_resumo || ''} ${dados.evento_resumo || ''}`.toUpperCase();
    if (/CUMPRIMENTO\s+DE\s+SENTEN|FASE DE CUMPRIMENTO|ART\.?\s*524/.test(blob)) return false;
    return true;
  }
  return false;
}

/** Contagens canônicas para painel / report / dossiê (mesma regra em todo o app). */
export function countEncerradosCarteira(cases: any[]): number {
  return (cases || []).filter(isCasoEncerrado).length;
}

export function countBaixasTribunal(cases: any[]): number {
  return (cases || []).filter(isBaixaTribunal).length;
}

export function countAtivosCarteira(cases: any[]): number {
  return (cases || []).filter((c) => !isCasoEncerrado(c)).length;
}
