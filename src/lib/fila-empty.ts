/**
 * Empty state da fila crítica: dizer *por que* está vazia (P0).
 */

export type FilaEmptyContext = {
  totalCarteira: number;
  ativos: number;
  comPrazo: number;
  pendingCount: number;
  completedToday: number;
  filaFiltro?: string;
  hasSearch?: boolean;
  hasOfficeFilter?: boolean;
  hasLawyerFilter?: boolean;
};

export function explainFilaVazia(ctx: FilaEmptyContext): { title: string; description: string } | null {
  if (ctx.pendingCount > 0) return null;

  const filtroAtivo =
    (ctx.filaFiltro && ctx.filaFiltro !== 'all') ||
    ctx.hasSearch ||
    ctx.hasOfficeFilter ||
    ctx.hasLawyerFilter;

  if (ctx.totalCarteira === 0) {
    return {
      title: 'Carteira vazia',
      description: 'Nenhum processo no banco desta empresa. Importe a planilha W1 para montar a fila.',
    };
  }

  if (ctx.ativos === 0) {
    return {
      title: 'Nenhum processo ativo',
      description: `${ctx.totalCarteira} na carteira, todos encerrados/arquivados. A fila só lista casos em andamento.`,
    };
  }

  if (filtroAtivo) {
    return {
      title: 'Filtro escondeu a fila',
      description: `${ctx.ativos} ativos na carteira (${ctx.comPrazo} com prazo). Limpe busca, escritório, advogado ou aba da fila para ver o total.`,
    };
  }

  if (ctx.completedToday > 0 && ctx.comPrazo > 0) {
    return {
      title: 'Fila do dia concluída',
      description: `${ctx.completedToday} cliente(s) já atendidos hoje. Ainda há ${ctx.comPrazo} processo(s) com prazo — voltam amanhã ou no backlog se desmarcar o contato.`,
    };
  }

  if (ctx.comPrazo === 0) {
    return {
      title: 'Ativos sem prazo mapeado',
      description: `${ctx.ativos} processo(s) ativos, mas nenhum com coluna PRÓXIMO RETORNO. Reimporte a planilha e confira o diagnóstico de colunas.`,
    };
  }

  return {
    title: 'Fila vazia',
    description: `${ctx.comPrazo} prazo(s) no banco e ${ctx.ativos} ativos. Se isso persistir, o filtro de “já contatado hoje” ou blacklist pode estar ocultando os cards.`,
  };
}
