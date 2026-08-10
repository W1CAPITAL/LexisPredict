/**
 * Substituições de microcopy: cara de IA → operacional.
 * Use nos títulos de seção ao renderizar.
 */
export const MICROCOPY: Record<string, string> = {
  'Telemetria Forense': 'Andamentos e publicações',
  'Telemetria Unificada (Sinal 3D)': 'Andamentos e publicações',
  'Telemetria Unificada': 'Andamentos e publicações',
  'Unidade Neural': 'Sugestão de resposta',
  'Sequência Prioritária': 'Fila de contato',
  'Fila Prioritária de Gestão': 'Fila de contato',
  'Sincronizando Gabinete': 'Carregando processos',
  'Gabinete Estratégico • Vigilância Unificada': 'Visão da carteira',
  'Ambiente Authority v17.5': 'Operação',
  'Advanced Judicial Monitoring • Authority v17.5': 'Monitoramento processual',
  'Novidade relevante': 'Nova movimentação',
  'Motor Neural': 'Sugestão',
  'Briefing Neural': 'Resumo do dia',
  'Briefing Estratégico': 'Resumo do dia',
  'Dossiê Operacional da Carteira': 'Relatório da carteira',
  'Scanner Omnipresente': 'Scanner de processos',
  'Auditoria 3D': 'Auditoria unificada',
  'Rede Judicial': 'Tribunais',
};

export function opsLabel(raw: string): string {
  return MICROCOPY[raw] || raw;
}
