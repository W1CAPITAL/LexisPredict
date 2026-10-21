import type { SupervisaoSnapshot, SupervisaoUsuarioGrupo } from "@/app/actions/supervisao-actions";

/**
 * Narrativa do PDF calculada exclusivamente a partir do snapshot corrente.
 * Não confundir afirmações antigas de reuniões/chats com métricas verificadas.
 */
export type PapelOperador = { nomeMatch: string; titulo: string; papel: string };
export const PAPEIS_OPERACAO: PapelOperador[] = [];
export const FATO_WHATSAPP =
  "O estado da fila e a entrega de mensagens no WhatsApp não fazem parte desta consulta. Verifique os registros de envio antes de declarar a fila zerada.";
export function papelDe(_nome: string): PapelOperador | null {
  return null;
}
export type RelatorioEquipePessoa = {
  nome: string;
  papel: string;
  linha: string;
  vencidos: number;
};
export type RelatorioEquipeData = {
  geradoEm: string;
  periodoLabel: string;
  kpis: { valor: string; rotulo: string }[];
  pessoas: RelatorioEquipePessoa[];
  leitura: string[];
  canais: string[];
  esconde: string[];
  recado: string;
  proxima: string[];
  whatsapp: string;
};
function linhaPessoa(u: SupervisaoUsuarioGrupo) {
  return `${u.total} processos · ${u.ativos} ativos · ${u.atendidosSemana} com atividade humana no período · ${u.vencidos} vencidos`;
}
export function montarRelatorioEquipe(
  snap: SupervisaoSnapshot,
  opts?: { geradoEm?: string }
): RelatorioEquipeData {
  const grupos: SupervisaoUsuarioGrupo[] = (snap.porUsuario || []).length
    ? snap.porUsuario
    : (snap.operadores || []).map(o => ({
        key: o.nome, nome: o.nome, total: o.total, ativos: o.ativos,
        encerrados: o.encerrados, baixasTribunal: 0, vencidos: o.vencidos,
        novidades: o.novidades, atendimentos: o.atendimentos,
        atendidosSemana: o.atendidosSemana, semRetorno: o.semRetorno,
        ba: o.ba, processos: [],
      }));
  const a = snap.analisesInternas;
  const pessoas: RelatorioEquipePessoa[] = grupos.map(u => {
    const davi=/\bDAVI\b/i.test(u.nome);
    const tarefas=(a?.tarefasPorPessoa||[]).find(x=>x.nome.toUpperCase()===u.nome.toUpperCase());
    return {
      nome: u.nome || "Sem usuário identificado",
      papel: davi
        ? "Carteira processual, dossiês, auditoria documental, investigações, sistemas e automações."
        : "Carteira conforme titularidade cadastrada no Supabase.",
      linha: linhaPessoa(u)+(tarefas?` · ${tarefas.periodo} tarefas concluídas no período`:"")+(davi&&a?` · ${a.processosAnalisados} processos com análise interna registrada na empresa (inclui auditoria sistêmica, sem contato presumido)`:""),
      vencidos: u.vencidos,
    };
  });
  const maioresVencidos = [...pessoas].filter(p => p.vencidos > 0)
    .sort((a,b) => b.vencidos - a.vencidos).slice(0,3);
  const maiorCarteira = [...grupos].sort((a,b)=>b.total-a.total)[0];
  const leitura = [
    ...(a ? [`A equipe registrou ${a.tarefasConcluidasPeriodo} tarefas concluídas manualmente neste período; Davi realizou ${a.tarefasDaviPeriodo}. Tarefas de sistema, análises e contatos são classificados separadamente.`] : []),
    ...(a ? [`Produção analítica cadastrada na empresa: ${a.processosAnalisados} processos com registro de análise, ${a.auditoriaDocumental} anotações documentais, ${a.triagemReplicaProvas} triagens de réplica e provas, ${a.dossiesIndividuais} dossiês, ${a.investigacoesExternas} levantamentos externos e ${a.projetos} entregas de projeto. Esses registros não identificam individualmente o executor por categoria nem equivalem a contato com cliente.`] : []),
    `A base consultada contém ${snap.total} processos: ${snap.ativos} ativos e ${snap.encerrados} encerrados.`,
    `Foram identificados ${snap.vencidos} processos ativos com status operacional Vencido ou Caso Crítico. Datas antigas isoladas não entram nesse KPI; devem ser revisadas como inconsistências separadas.`,
    `Existem ${snap.atendimentosTotais} processos com data de último retorno cadastrada. No período selecionado, ${snap.atendidosSemana} processos tiveram registro de atendimento ou encerramento associado a usuário humano; não é prova de contato por WhatsApp nem contagem de edições.`,
    `O banco sinaliza ${snap.novidades} processos com novidade e ${snap.baixasTribunal} registros com indicador DataJud de encerramento/baixa. O indicador não comprova trânsito em julgado em cada processo.`,
    maiorCarteira
      ? `Maior carteira atribuída nesta consulta: ${maiorCarteira.nome}, com ${maiorCarteira.total} processos. Identificadores legados são reunidos quando correspondem ao mesmo usuário.`
      : "Não foi possível associar processos a usuários neste corte.",
  ];
  const canais = [
    FATO_WHATSAPP,
    "Procon, SAC, Reclame Aqui e outras demandas externas precisam de fontes próprias; não são inferidos do campo último retorno dos processos.",
  ];
  const esconde = [
    `Processos sem último retorno registrado: ${snap.semRetorno}.`,
    `No período: ${snap.auditadosSemana} lançamentos novos de auditoria (excluídas ${snap.auditoriasImportadasPeriodo||0} importações), ${snap.auditadosTribunalSemana} processos com data de última consulta DataJud/DJEN no período (inclusive cargas), ${snap.editadosAppSemana} CNJs distintos editados (${snap.edicoesEventosPeriodo||0} registros de edição).`,
    "As contagens retratam o estado do banco no momento da consulta, não uma planilha estática.",
  ];
  const proxima = [
    ...maioresVencidos.map(p => `Revisar a fila de ${p.nome}: ${p.vencidos} vencidos.`),
    `Conferir ${snap.semRetorno} cadastros sem retorno registrado, priorizando os ativos.`,
    `Triar ${snap.novidades} novidades antes de programar contato.`,
    "Confirmar mensagens entregues e demandas resolvidas na origem; não deduzir resposta de simples alteração cadastral.",
  ];
  const recado = `Corte: ${snap.periodoLabel || "período atual"}. Dados extraídos em ${snap.geradoEm ? new Date(snap.geradoEm).toLocaleString("pt-BR", {timeZone:"America/Sao_Paulo"}) : "horário não informado"}. Prioridade operacional: retorno vencido, novidade ainda sem comunicação e cadastro sem contato. Não há verificação automática de conclusão das demandas externas neste relatório.`;
  return {
    geradoEm: opts?.geradoEm || new Date().toLocaleString("pt-BR", {timeZone:"America/Sao_Paulo"}),
    periodoLabel: snap.periodoLabel || "período atual",
    kpis: [
      { valor: String(snap.total), rotulo: "na base" },
      { valor: String(snap.ativos), rotulo: "ativos" },
      { valor: String(snap.encerrados), rotulo: "encerrados" },
      { valor: String(snap.baixasTribunal), rotulo: "baixa tribunal" },
      { valor: String(snap.vencidos), rotulo: "vencidos" },
      { valor: String(snap.novidades), rotulo: "novidades" },
      { valor: String(snap.atendimentosTotais), rotulo: "com retorno" },
      { valor: String(snap.atendidosSemana), rotulo: "atividade humana no período" },
      { valor: String(a?.atendidosInternamenteNoPeriodo ?? 0), rotulo: "atendidos internamente (análise)" },
      { valor: String(a?.processosAnalisados ?? 0), rotulo: "processos auditados/analisados" },
      { valor: String(a?.tarefasConcluidasPeriodo ?? 0), rotulo: "tarefas concluídas equipe" },
      { valor: String(a?.tarefasDaviPeriodo ?? 0), rotulo: "tarefas concluídas Davi" },
    ],
    pessoas, leitura, canais, esconde, recado, proxima, whatsapp: FATO_WHATSAPP,
  };
}
