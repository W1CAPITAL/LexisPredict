import {
  flagProcedente,
  flagImprocedente,
  flagCumprimentoAtivo,
  flagCumprimentoEncerrado,
  flagFaltaInstaurar,
  flagOportunidadeHonorarios,
  flagSucumbencia,
  oportunidadeOf,
} from '@/lib/kpi-executivo';

/** Colunas legíveis para Excel — sem ids internos. */
export function rowExecutivoExport(c: any): Record<string, string | number | boolean> {
  const op = oportunidadeOf(c);
  return {
    cliente: c.cliente || '',
    protocolo: c.protocolo || c.protocolo_ref || '',
    telefone: c.telefone || '',
    tribunal: c.tribunal || '',
    advogado: c.advogado || '',
    escritorio: c.escritorio || '',
    status: c.status || c.situacao || '',
    ultimo_retorno: c.ultimoRetorno || c.ultimo_retorno || '',
    procedente: flagProcedente(c) ? 'SIM' : 'NÃO',
    improcedente: flagImprocedente(c) ? 'SIM' : 'NÃO',
    cumprimento_ativo: flagCumprimentoAtivo(c) ? 'SIM' : 'NÃO',
    cumprimento_encerrado: flagCumprimentoEncerrado(c) ? 'SIM' : 'NÃO',
    falta_instaurar: flagFaltaInstaurar(c) ? 'SIM' : 'NÃO',
    oportunidade_honorarios: flagOportunidadeHonorarios(c) ? 'SIM' : 'NÃO',
    sucumbencia: flagSucumbencia(c) ? 'SIM' : 'NÃO',
    score_oportunidade: op?.score ?? c.oportunidade_score ?? '',
    tipo_credito: op?.tipo_credito || op?.tipo || '',
    evento: c.evento_resumo || c.evento_tipo || '',
    observacao: (c.observacao || '').replace(/\[LISTA:[^\]]+\]/gi, '').trim(),
  };
}
