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
  const pessoas: RelatorioEquipePessoa[] = grupos.map(u => ({
    nome: u.nome || "Sem usuário identificado",
    papel: "Carteira conforme titularidade cadastrada no Supabase.",
    linha: linhaPessoa(u),
    vencidos: u.vencidos,
  }));
  const maioresVencidos = [...pessoas].filter(p => p.vencidos > 0)
    .sort((a,b) => b.vencidos - a.vencidos).slice(0,3);
  const maiorCarteira = [...grupos].sort((a,b)=>b.total-a.total)[0];
  const leitura = [
    `A base consultada contém ${snap.total} processos: ${snap.ativos} ativos e ${snap.encerrados} encerrados.`,
    `Foram identificados ${snap.vencidos} processos com retorno vencido. O vencimento é reavaliado pela data do retorno programado na consulta.`,
    `Existem ${snap.atendimentosTotais} processos com último retorno registrado. No período selecionado, ${snap.atendidosSemana} processos tiveram atividade humana registrada (contato ou edição); não é contagem de mensagens enviadas.`,
    `O banco sinaliza ${snap.novidades} casos com novidade e ${snap.baixasTribunal} baixas de tribunal. Confirmar o detalhe no processo antes de informar o cliente.`,
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
    `Auditorias/edições na semana: ${snap.auditadosSemana}; verificações de tribunal sinalizadas: ${snap.auditadosTribunalSemana}; edições no app: ${snap.editadosAppSemana}.`,
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
    ],
    pessoas, leitura, canais, esconde, recado, proxima, whatsapp: FATO_WHATSAPP,
  };
}
