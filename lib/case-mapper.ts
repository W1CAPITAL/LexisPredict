/**
 * @fileOverview MOTOR DE MAPEAMENTO UNIVERSAL v100.0 (Authority Edition)
 * Centraliza a escrita de registros para garantir sincronia JSONB ↔ Colunas Planas.
 */

import { extrairTribunal, calcularStatus, RiskLevel } from './case-logic';
import { parseBrazilianDate } from './dates';

export function buildProcessoRecord(input: {
  empresaId: string;
  userId: string;
  cliente: string;
  protocolo: string;
  telefone?: string;
  advogado?: string;
  escritorio?: string;
  situacao?: string;           // da planilha / interno (EM ANDAMENTO, etc)
  observacao?: string;
  ultimoRetorno?: string | null;
  proximoRetorno?: string | null;
  produtos?: string;
  atendente?: string;
  statusManual?: string;       // 'Automatico' | 'Caso Crítico' | 'Encerrado'...
}) {
  const cleanProtocolo = (input.protocolo || '').trim();
  const tribunalData = extrairTribunal(cleanProtocolo);
  
  const isoProximo = parseBrazilianDate(input.proximoRetorno);
  const isoUltimo = parseBrazilianDate(input.ultimoRetorno);
  
  const statusManual = input.statusManual || 'Automatico';
  const situacaoNormalizada = (input.situacao || 'EM ANDAMENTO').toUpperCase();
  
  // Status de prazo calculado pelo motor de lógica
  const statusCalculado = calcularStatus(isoProximo, situacaoNormalizada);

  // O Status final exibido respeita a trava manual ou segue o automático
  const statusFinal = statusManual === 'Automatico' ? statusCalculado : statusManual;
  
  // Risco lógico baseado no status final ou trava crítica
  const risco: RiskLevel = (statusFinal === 'Vencido' || statusManual === 'Caso Crítico') ? "Crítico" : "Normal";

  const dados = {
    id: cleanProtocolo,
    cliente: (input.cliente || 'NÃO IDENTIFICADO').toUpperCase(),
    protocolo: cleanProtocolo,
    telefone: (input.telefone || '').replace(/\D/g, ''),
    advogado: (input.advogado || 'NÃO ATRIBUÍDO').toUpperCase(),
    escritorio: input.escritorio || '',
    situacao: situacaoNormalizada,
    status: statusFinal,
    statusManual,
    risco,
    observacao: input.observacao || '',
    ultimoRetorno: isoUltimo || '',
    proximoPrazo: isoProximo || '',
    tribunal: tribunalData.tribunal,
    produtos: input.produtos || '',
    atendente: input.atendente || '',
  };

  return {
    empresa_id: input.empresaId,
    created_by: input.userId,
    protocolo_ref: cleanProtocolo,
    tribunal: tribunalData.tribunal,
    status: statusFinal,
    risco,
    status_interno: situacaoNormalizada,
    status_prazo: statusCalculado,
    observacoes: input.observacao || null,
    advogado: (input.advogado || 'NÃO ATRIBUÍDO').toUpperCase(),
    escritorio: input.escritorio || null,
    telefone: (input.telefone || '').replace(/\D/g, '') || null,
    ultimo_retorno: isoUltimo,
    proximo_retorno: isoProximo,
    produtos: input.produtos || null,
    dados,
  };
}
