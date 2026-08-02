/**
 * Sequência prioritária da fila crítica (Tarefas).
 * Ordem operacional clara — sem jargão.
 *
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import type { LegalCase } from './case-logic';
import { isCasoEncerrado } from './status-encerrado';
import { resolveTemNovoAndamento } from './novidade';
import { hasAudienciaPosRetorno, isSentencaImprocedente, isSentencaProcedente } from './merito-detect';

/** Peso maior = mais urgente (ordenar desc) */
export function pesoFila(c: LegalCase): number {
  let w = 0;

  // 1. Encerramento / baixa no tribunal (fechar ou comunicar)
  if (c.datajud_encerrado_tribunal || c.evento_tipo === 'transito_ou_baixa' || c.evento_tipo === 'transito_baixa') {
    w += 1000;
  }

  // 2. Sentença (improcedente um pouco acima — risco de recurso/cliente)
  if (isSentencaImprocedente(c)) w += 920;
  else if (isSentencaProcedente(c)) w += 900;
  else if (c.evento_tipo === 'sentenca_parcial' || c.evento_tipo === 'liminar') w += 880;
  else if (c.evento_tipo?.startsWith('sentenca')) w += 860;

  // 3. Audiência após último retorno
  if (hasAudienciaPosRetorno(c)) w += 800;

  // 4. Cumprimento / execução
  if (c.em_cumprimento_sentenca || c.evento_tipo === 'cumprimento_sentenca') w += 700;

  // 5. Novidade tribunal/diário não atendida
  if (resolveTemNovoAndamento(c)) w += 500;

  // 6. Status de prazo
  if (c.status === 'Caso Crítico') w += 400;
  else if (c.status === 'Vencido') w += 350;
  else if (c.status === 'É Hoje') w += 300;
  else if (c.status === 'Atenção') w += 150;

  // 7. Tempo sem retorno (quanto mais dias, mais peso leve)
  const dias = diasSemRetorno(c.ultimoRetorno);
  if (dias != null) w += Math.min(120, Math.floor(dias / 2));

  // Desempate: menos dias de prazo primeiro
  if (typeof c.diasFaltando === 'number') w += Math.max(0, 30 - c.diasFaltando);

  return w;
}

function diasSemRetorno(ultimoRetorno?: string | null): number | null {
  if (!ultimoRetorno || !String(ultimoRetorno).trim()) return 90;
  try {
    const raw = String(ultimoRetorno).trim();
    const d = new Date(raw.includes('/') ? raw.split('/').reverse().join('-') : raw);
    if (Number.isNaN(d.getTime())) return 60;
    return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
  } catch {
    return 60;
  }
}

export function ordenarFilaCritica(cases: LegalCase[], limit?: number): LegalCase[] {
  const list = cases
    .filter((c) => !isCasoEncerrado(c))
    .filter(
      (c) =>
        resolveTemNovoAndamento(c) ||
        c.datajud_encerrado_tribunal ||
        c.em_cumprimento_sentenca ||
        hasAudienciaPosRetorno(c) ||
        isSentencaProcedente(c) ||
        isSentencaImprocedente(c) ||
        ['Caso Crítico', 'Vencido', 'É Hoje', 'Atenção'].includes(c.status)
    )
    .sort((a, b) => pesoFila(b) - pesoFila(a));

  return typeof limit === 'number' ? list.slice(0, limit) : list;
}

export function rotuloPrioridade(c: LegalCase): string {
  if (c.datajud_encerrado_tribunal) return 'Baixa no tribunal';
  if (isSentencaImprocedente(c)) return 'Sentença improcedente';
  if (isSentencaProcedente(c)) return 'Sentença procedente';
  if (hasAudienciaPosRetorno(c)) return 'Audiência';
  if (c.em_cumprimento_sentenca) return 'Cumprimento';
  if (resolveTemNovoAndamento(c)) return 'Nova movimentação';
  if (c.status === 'Vencido' || c.status === 'Caso Crítico') return 'Prazo vencido';
  if (c.status === 'É Hoje') return 'Prazo hoje';
  return 'Acompanhar';
}
