/**
 * Merge de import sobre processo existente: não apaga flags de scan nem created_by.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital
 */

const FLAG_KEYS = [
  'tem_atualizacao_pos_retorno',
  'tem_novo_andamento',
  'datajud_hash',
  'djen_ultimo_resumo',
  'indicio_busca_apreensao',
  'em_cumprimento_sentenca',
  'datajud_encerrado_tribunal',
  'djen_nova_comunicacao',
  'is_procedente',
  'cumprimento_pendente_necessario',
  'oportunidade_instaurar',
  'status_executivo',
] as const;

/**
 * @param incoming — linha pronta para upsert
 * @param existing — row do Supabase (ou undefined se CNJ novo)
 */
export function mergeImportOverExisting<T extends Record<string, any>>(
  incoming: T,
  existing?: Record<string, any> | null
): T {
  if (!existing) {
    // Insert: created_by já veio do import (assistente ou auth)
    return incoming;
  }

  const merged: Record<string, any> = { ...incoming };

  // NUNCA sobrescrever dono da carteira
  if (existing.created_by) {
    merged.created_by = existing.created_by;
  }

  // Preservar flags de scan / domínio se o import não trouxer valor “mais novo”
  for (const k of FLAG_KEYS) {
    const inc = incoming[k];
    const ex = existing[k];
    if ((inc === null || inc === undefined || inc === '') && ex != null && ex !== '') {
      merged[k] = ex;
    }
  }

  // dados JSON: merge superficial — flags internas do scan sobrevivem
  const incDados = (incoming.dados && typeof incoming.dados === 'object') ? { ...incoming.dados } : {};
  const exDados = (existing.dados && typeof existing.dados === 'object') ? existing.dados : {};
  const dadosKeysKeep = [
    'datajud_ultimo_nome',
    'djen_ultimo_tipo',
    'scan_at',
    'atendido_por',
    'atendido_em',
    'atendido_por_nome',
    'flags_scan',
    'prioridade_critica_ia',
    'alerta_ia',
  ];
  for (const k of dadosKeysKeep) {
    if ((incDados[k] == null || incDados[k] === '') && exDados[k] != null) {
      incDados[k] = exDados[k];
    }
  }
  merged.dados = { ...exDados, ...incDados };

  // Datas: se import veio vazio, manter a do banco
  if (!merged.ultimo_retorno && existing.ultimo_retorno) {
    merged.ultimo_retorno = existing.ultimo_retorno;
  }
  if (!merged.proximo_retorno && existing.proximo_retorno) {
    merged.proximo_retorno = existing.proximo_retorno;
  }

  return merged as T;
}
