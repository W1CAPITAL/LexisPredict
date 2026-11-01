import type { EquipeRelatorio } from '@/components/report/team-report';
import type { AnalisesPessoaisPdfData } from '@/components/pdf/analises-internas-pdf';
import type { SupervisaoSnapshot } from '@/app/actions/supervisao-actions';
import type { RelatorioEquipeData } from '@/lib/relatorio-equipe-narrativa';
import type { DossieOperacionalData } from '@/components/pdf/dossie-operacional-pdf';
import {
  REPORT_COLORS as C, reportCategory, reportDate, reportNumber, reportPersonColor,
  reportPriorities, reportValue, type VisualReport, type ReportSection, type ReportMetric,
} from './visual-report';

export type ReportPdfOverview = {
  total: number | null; ativos: number | null; encerrados: number | null; vencidos: number | null;
  novidades: number | null; atendidos: number | null; eventos: number | null; semRetorno30: number | null;
  meritoPendente: number | null; procedentes: number | null; improcedentes: number | null; parciais: number | null; semMerito: number | null;
};
export type ReportPdfDay = { ymd: string; atendimentos: number; encerramentos: number };
export type ReportPdfDailyPerson = { userId: string; nome: string; ymd: string; processos: number; eventos: number; encerramentos: number };
export type TeamReportInput = {
  data: EquipeRelatorio; overview: ReportPdfOverview; scope: string; trend?: ReportPdfDay[];
  daily?: ReportPdfDailyPerson[]; company?: string; generatedAt?: string;
};
const metric = (label: string, value: unknown, note?: string, color: string = C.blue): ReportMetric => ({ label, value: reportNumber(value), note, color });
const METHODS = [
  'Carteira é a situação atual no CRM. Atendimentos, edições e atividades são registros do período indicado; não some métricas de natureza diferente.',
  'Encerramento no CRM não equivale a êxito judicial. Classificações de mérito exigem conferência de recursos, cumprimento e trânsito em julgado.',
  'Ausência de confirmação de recebimento não demonstra inadimplência. Novas mensagens, SAC e trabalho fora do sistema podem não estar integralmente registrados.',
];

export function buildTeamVisualReport(input: TeamReportInput): VisualReport {
  const { data, overview: o, scope, trend = [], daily = [] } = input;
  const people = [...(data.pessoas || [])].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const metrics = [metric('Carteira atual', o.total, 'Total cadastral atual'), metric('Ativos', o.ativos, 'Situação no CRM', C.teal),
    metric('Encerrados no CRM', o.encerrados, 'Situação administrativa', C.purple), metric('Processos atendidos', o.atendidos, 'Distintos no período'),
    metric('Eventos de atendimento', o.eventos, 'Registros do período', C.purple), metric('Vencidos', o.vencidos, 'Classificação no CRM', C.red)];
  const sections: ReportSection[] = [
    { id: 'prioridades', kind: 'notes', title: 'O que merece atenção', items: reportPriorities({ overdue: o.vencidos, news: o.novidades, missing: o.semRetorno30 }) },
    { id: 'carteira', kind: 'charts', title: 'Distribuição da carteira', subtitle: 'Situação atual, independente do período das atividades.', series: [{ label: 'Situação no CRM', values: [
      { label: 'Ativos', value: o.ativos }, { label: 'Encerrados', value: o.encerrados },
      { label: 'Outras situações', value: o.total != null && o.ativos != null && o.encerrados != null ? Math.max(0, o.total - o.ativos - o.encerrados) : null },
    ] }] },
    { id: 'equipe', kind: 'people', title: 'A equipe, pessoa por pessoa', subtitle: 'Mesmo espaço para cada profissional. Os registros não representam todo o trabalho realizado.', people: people.map(p => ({
      id: p.userId, name: p.nome, role: p.cargo || 'Colaborador', metrics: [
        metric('Atendimentos', p.atendimentos.eventos), metric('Atividades no período', p.atividades.registros),
        metric('Análises e projetos', p.trabalho.registros), metric('Edições', p.edicoes.processos),
      ], note: `${reportValue(p.atividades.contatosDeclarados)} contatos declarados no período. ${reportValue(p.trabalho.verificacoesLote)} verificações em lote, separadas dos contatos humanos.`,
    })) },
    { id: 'comparativo', kind: 'table', title: 'Distribuição dos registros da equipe', subtitle: 'Atribuição ao executor registrado; carteira é titularidade atual, não produtividade.',
      columns: ['Pessoa', 'Carteira', 'Atendimentos', 'Atividades período', 'Atividades histórico', 'Edições', 'Encerramentos'],
      rows: people.map(p => [p.nome, p.carteira.total, p.atendimentos.eventos, p.atividades.registros, p.atividades.registrosTotal, p.edicoes.processos, p.encerramentos.processos]) },
  ];
  if (trend.length) sections.push({ id: 'evolucao', kind: 'charts', title: 'Evolução dos atendimentos', subtitle: 'Eventos registrados por dia no período selecionado.', series: [{ label: 'Atendimentos por dia', color: C.teal, values: trend.map(d => ({ label: reportDate(d.ymd), value: reportNumber(d.atendimentos) })) }] });
  if (daily.length) sections.push({ id: 'diario', kind: 'table', title: 'Atendimentos, pessoa por dia', subtitle: 'Processos distintos no dia, eventos e encerramentos registrados. Não são clientes únicos do mês.',
    columns: ['Data', 'Pessoa', 'Processos atendidos', 'Eventos', 'Encerramentos'], rows: [...daily].sort((a, b) => a.ymd.localeCompare(b.ymd) || a.nome.localeCompare(b.nome, 'pt-BR')).map(d => [reportDate(d.ymd), d.nome, d.processos, d.eventos, d.encerramentos]) });
  sections.push({ id: 'merito', kind: 'metrics', title: 'Mérito judicial identificado', subtitle: 'Indicadores disponíveis na fonte estruturada. Não confirmam desfecho de recurso nem trânsito.', metrics: [
    metric('Procedências', o.procedentes, undefined, C.teal), metric('Procedências parciais', o.parciais, undefined, C.gold),
    metric('Improcedências', o.improcedentes, undefined, C.red), metric('Sem julgamento de mérito', o.semMerito), metric('A esclarecer', o.meritoPendente),
  ] });
  for (const p of people) {
    const color = reportPersonColor(p.userId);
    const categories = [...(p.atividades.categorias || []), ...(p.trabalho.categorias || [])];
    if (categories.length) sections.push({ id: 'categorias-' + p.userId, kind: 'charts', title: 'Atividades de ' + p.nome,
      subtitle: 'Categorias nas fontes de atividades e trabalho analítico. Podem se sobrepor; não são somadas como contatos.', series: [{ label: 'Registros por categoria', color, values: categories.map((x, i) => ({ label: reportCategory(x.categoria) + (i >= p.atividades.categorias.length ? ' · analítico' : ''), value: reportNumber(x.registros) })) }] });
    const records = [
      ...(p.trabalho.entregasRecentes || []).map(x => ({ title: x.titulo, body: x.detalhe, meta: reportDate(x.data) + ' / ' + reportCategory(x.categoria), source: x.conferencia ? reportCategory(x.conferencia) : undefined })),
      ...(p.atividades.recentes || []).map(x => ({ title: x.titulo, body: x.detalhe, meta: reportDate(x.data) + ' / ' + reportCategory(x.categoria), reference: x.protocolo || undefined })),
    ];
    if (records.length) sections.push({ id: 'evidencias-' + p.userId, kind: 'records', title: 'Entregas e registros de ' + p.nome, subtitle: 'Descrições disponíveis nas fontes consultadas. Histórico integral no aplicativo.', records });
  }
  sections.push({ id: 'fontes', kind: 'notes', title: 'Fontes e critérios de leitura', items: [...METHODS, 'Fonte: carteira e registros autorizados do LexisPredict. “—” significa fonte indisponível; zero significa contagem retornada pela consulta.'] });
  return { title: 'Relatório executivo', subtitle: 'Equipe, atendimento e carteira em uma leitura visual.', company: input.company || 'Empresa vinculada', scope,
    period: reportDate(data.inicio) + ' a ' + reportDate(data.fim), generatedAt: input.generatedAt || new Date().toISOString(), metrics, sections, limitations: METHODS };
}

export function buildPersonalVisualReport(data: AnalisesPessoaisPdfData): VisualReport {
  const t = data.totais;
  return {
    title: 'Minhas análises e atividades', subtitle: 'Seu histórico pessoal, com a origem de cada registro.', company: data.empresa || 'Empresa vinculada', scope: data.nome,
    period: [data.filtros.busca ? `Busca: ${data.filtros.busca}` : 'Todos os CNJs', data.filtros.categoria ? reportCategory(data.filtros.categoria) : 'Todas as categorias'].join(' / '),
    generatedAt: data.geradoEm,
    metrics: [metric('Análises no filtro', t.analises, 'Total da seleção', C.purple), metric('Atividades manuais', t.atividades, 'Total da seleção'), metric('Ações operacionais', t.acoes, 'Edições e atendimentos', C.teal), metric('Auditorias documentais', t.documentais, 'Histórico pessoal', C.gold)],
    sections: [
      { id: 'distribuicao', kind: 'charts', title: 'Origem dos registros', subtitle: 'Tipos de registro distintos; não representam pessoas ou processos únicos.', series: [{ label: 'Fontes', values: [{ label: 'Análises', value: t.analises }, { label: 'Atividades', value: t.atividades }, { label: 'Ações operacionais', value: t.acoes }] }] },
      { id: 'analises', kind: 'records', title: 'Análises documentadas', subtitle: `Página ${data.paginas.analises} da seleção: ${data.analises.length} registros neste PDF; ${t.analises} no filtro.`, records: data.analises.map(x => ({ title: x.protocolo_ref || 'Projeto ou investigação sem CNJ', body: x.descricao || undefined, meta: reportDate(x.data_atividade) + ' / ' + reportCategory(x.categoria) + ' / ' + reportCategory(x.nivel_conferencia), source: x.origem || undefined })) },
      { id: 'atividades', kind: 'records', title: 'Atividades registradas', subtitle: `Página ${data.paginas.atividades}: ${data.atividades.length} registros neste PDF; ${t.atividades} no filtro.`, records: data.atividades.map(x => ({ title: x.titulo || 'Atividade sem título', body: x.descricao || undefined, meta: reportDate(x.data_realizacao) + ' / ' + reportCategory(x.categoria), reference: x.protocolo_ref || undefined })) },
      { id: 'acoes', kind: 'table', title: 'Ações operacionais', subtitle: `Página ${data.paginas.acoes}: ${data.acoes.length} registros neste PDF; ${t.acoes} no filtro.`, columns: ['Data', 'Ação registrada', 'Processo'], rows: data.acoes.map(x => [reportDate(x.created_at), x.action === 'edicao' ? 'Edição no aplicativo' : 'Atendimento registrado', x.protocolo_ref || 'Sem CNJ vinculado']) },
      { id: 'metodo', kind: 'notes', title: 'Escopo e critérios', items: [
        'Relatório pessoal: somente os registros vinculados à empresa e à identidade autenticada do colaborador.',
        'Os totais representam os filtros da consulta. As listas contêm as páginas selecionadas na tela, sem apresentar a amostra como histórico completo.',
        'Ações técnicas e registros em lote não comprovam contato humano nem revisão jurídica integral. Descrições longas continuam no sistema.',
      ] },
    ], limitations: ['Exportação pessoal. Os totais e as listas podem ter recortes diferentes, conforme a paginação selecionada.'],
  };
}

export function buildSupervisionVisualReport(data: SupervisaoSnapshot, auditor?: string): VisualReport {
  const a = data.analisesDisponiveis===false?undefined:data.analisesInternas;
  const groups = data.porUsuario?.length ? data.porUsuario : data.operadores.map((x, i) => ({ ...x, key: String(i), processos: [], baixasTribunal: 0 }));
  return {
    title: 'Supervisão operacional', subtitle: 'Carteira, pessoas e prioridades da operação.', company: data.empresaNome || 'Empresa vinculada', scope: auditor ? 'Supervisão / ' + auditor : 'Supervisão da empresa',
    period: data.periodoLabel || 'Período consultado', generatedAt: data.geradoEm || new Date().toISOString(),
    metrics: [metric('Processos', data.total, 'Carteira atual'), metric('Ativos', data.ativos, 'Situação atual', C.teal), metric('Encerrados no CRM', data.encerrados, 'Situação administrativa', C.purple), metric('Vencidos', data.vencidos, 'Critério operacional', C.red), metric('Processos atendidos', data.atendidosSemana, 'Distintos no período'), metric('Tarefas da equipe', a?.tarefasConcluidasPeriodo, 'Registradas no período', C.teal)],
    sections: [
      { id: 'prioridades', kind: 'notes', title: 'Prioridades do acompanhamento', items: reportPriorities({ overdue: data.vencidos, news: data.novidades, missing: data.semRetorno }) },
      { id: 'pessoas', kind: 'people', title: 'A equipe, pessoa por pessoa', subtitle: 'Carteira atribuída e eventos registrados. A atribuição de processos não representa o total do trabalho.', people: groups.map(x => ({ id: x.key, name: x.nome, role: 'Carteira conforme titularidade cadastrada', metrics: [metric('Carteira', x.total), metric('Ativos', x.ativos), metric('Vencidos', x.vencidos), metric('Atendidos no período', x.atendidosSemana)] })) },
      { id: 'comparativo', kind: 'table', title: 'Carteira por responsável', columns: ['Pessoa', 'Carteira', 'Ativos', 'Vencidos', 'Novidades', 'Atendidos no período'], rows: groups.map(x => [x.nome, x.total, x.ativos, x.vencidos, x.novidades, x.atendidosSemana]) },
      { id: 'evolucao', kind: 'charts', title: 'Evolução registrada', subtitle: 'Histórico de atendimentos disponível na consulta.', series: [{ label: 'Processos atendidos', color: C.teal, values: data.timelineSemanal.map(x => ({ label: x.label, value: reportNumber(x.atendidos) })) }] },
      { id: 'distribuicao', kind: 'charts', title: 'Distribuição da carteira', subtitle: 'Contagens atuais, com a classificação original de cada fonte.', series: [
        { label: 'Por escritório', values: data.porEscritorio.map(x => ({ label: x.label, value: reportNumber(x.value) })) },
        { label: 'Por tribunal', values: data.porTribunal.map(x => ({ label: x.label, value: reportNumber(x.value) })) },
        { label: 'Por status', values: data.porStatus.map(x => ({ label: x.label, value: reportNumber(x.value) })) },
      ] },
      { id: 'tarefas', kind: 'table', title: 'Atividades concluídas por pessoa', subtitle: 'Período e histórico manual separados.', columns: ['Pessoa', 'Tarefas no período', 'Histórico manual'], rows: (a?.tarefasPorPessoa || []).map(x => [x.nome, x.periodo, x.total]) },
      { id: 'analitico', kind: 'metrics', title: 'Trabalho analítico da empresa', subtitle: 'Histórico cadastrado. Categorias podem se sobrepor e não equivalem a contato com cliente.', metrics: [metric('Processos analisados', a?.processosAnalisados), metric('Revisões documentais', a?.auditoriaDocumental), metric('Réplica e provas', a?.triagemReplicaProvas), metric('Dossiês', a?.dossiesIndividuais), metric('Investigações externas', a?.investigacoesExternas), metric('Projetos', a?.projetos)] },
      { id: 'fontes', kind: 'notes', title: 'Fontes e critérios', items: [...METHODS, 'O estado da fila e a entrega de WhatsApp não fazem parte deste snapshot. Confirme os envios na origem antes de declarar a fila zerada.'] },
    ], limitations: METHODS,
  };
}

export function buildNarrativeVisualReport(data: RelatorioEquipeData): VisualReport {
  return {
    title: 'Relatório da equipe', subtitle: 'Distribuição do trabalho e decisões de acompanhamento.', company: data.empresaNome || 'Empresa vinculada', scope: 'Equipe da empresa', period: data.periodoLabel, generatedAt: data.geradoEm,
    metrics: data.kpis.map((x, i) => ({ label: x.rotulo, value: x.valor, color: [C.blue, C.purple, C.teal][i % 3] })),
    sections: [
      { id: 'pessoas', kind: 'people', title: 'Como a equipe está distribuída', people: data.pessoas.map((p, i) => ({ id: p.nome + i, name: p.nome, role: p.papel, metrics: [metric('Vencidos', p.vencidos)], note: p.linha })) },
      { id: 'leitura', kind: 'notes', title: 'O que os números mostram', items: data.leitura },
      { id: 'canais', kind: 'notes', title: 'Atendimento e canais', items: data.canais },
      { id: 'limites', kind: 'notes', title: 'O que o painel não conta sozinho', items: data.esconde },
      { id: 'proximos', kind: 'notes', title: 'Próximos passos', items: [data.recado, ...data.proxima] },
    ], limitations: [data.whatsapp],
  };
}

export function buildOperationalVisualReport(data: DossieOperacionalData): VisualReport {
  const sections: ReportSection[] = [
    { id: 'resumo', kind: 'notes', title: 'Leitura da operação', items: data.resumoExecutivo },
  ];
  if (data.semana) sections.push({ id: 'evolucao', kind: 'charts', title: 'Atendimentos no período', series: [{ label: data.semana.label, values: data.semana.series.map(x => ({ label: x.day, value: reportNumber(x.atendidos) })) }] });
  if (data.finance) {
    const f = data.finance;
    sections.push({ id: 'financeiro', kind: 'metrics', title: 'Financeiro cadastrado', subtitle: 'Valores e status do controle financeiro; não comprovam crédito judicial ao cliente.', metrics: [
      { label: 'A receber', value: f.aReceber }, { label: 'Pago no cadastro', value: f.pago, color: C.teal }, { label: 'Vencido', value: f.vencido, color: C.red }, metric('Lançamentos', f.lancamentos),
    ] });
    if (f.destaques.length) sections.push({ id: 'lancamentos', kind: 'table', title: 'Lançamentos em destaque', columns: ['Cliente', 'Descrição', 'Valor', 'Status'], rows: f.destaques.map(x => [x.cliente, x.descricao, x.valor, x.status]) });
  }
  if (data.criticos.length) sections.push({ id: 'atencao', kind: 'table', title: 'Registros que pedem acompanhamento', subtitle: 'Sinais do cadastro para conferência; não são prazos judiciais certificados.', columns: ['Cliente', 'Processo', 'Sinal', 'Data'], rows: data.criticos.map(x => [x.cliente, x.protocolo, x.sinal, x.data]) });
  if (data.topChance.length) sections.push({ id: 'priorizacao', kind: 'table', title: 'Sinais de priorização', subtitle: 'Estimativas do sistema para triagem; não representam probabilidade de êxito judicial.', columns: ['Cliente', 'Processo', 'Índice estimado'], rows: data.topChance.map(x => [x.cliente, x.protocolo, reportValue(x.prob) + '%']) });
  if (data.claude?.texto) sections.push({ id: 'leitura-adicional', kind: 'records', title: 'Leitura adicional', subtitle: 'Texto gerado pelo mecanismo selecionado: ' + data.claude.engine, records: (data.claude.texto.match(/[\s\S]{1,900}/g) || []).map((body, i) => ({ title: 'Trecho ' + (i + 1), body })) });
  sections.push({ id: 'criterios', kind: 'notes', title: 'Fontes e critérios', items: METHODS });
  return { title: 'Relatório operacional completo', subtitle: 'Atendimento, carteira e evidências do período.', company: data.empresaNome || 'Empresa vinculada', scope: 'Preparado por ' + data.auditor, period: data.semana?.label || 'Período consultado', generatedAt: data.geradoEm,
    metrics: data.kpis.map(x => ({ label: x.label, value: x.value })), sections, limitations: METHODS };
}
