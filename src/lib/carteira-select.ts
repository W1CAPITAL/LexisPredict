/**
 * Projeções leves da tabela processos — evita select('*') na Fila/Dashboard.
 * O campo `dados` (JSON completo) só deve ir no detalhe do processo.
 */

/** Colunas suficientes para KPI, Fila e cards. */
export const PROCESSOS_LIST_COLUMNS = [
  "id",
  "empresa_id",
  "protocolo_ref",
  "created_by",
  "atendido_por",
  "created_at",
  "updated_at",
  "cliente",
  "advogado",
  "escritorio",
  "status",
  "fase",
  "prazo",
  "valor_causa",
  "tem_novo_andamento",
  "tem_atualizacao_pos_retorno",
  "datajud_encerrado_tribunal",
  "datajud_ultimo_nome",
  "datajud_consultado_em",
  "djen_nova_comunicacao",
  "djen_ultimo_resumo",
  "djen_ultimo_link",
  "ultimo_retorno",
  "fila_lista",
  "telefone",
].join(",");

/** Ainda mais leve — só contagens / ranking. */
export const PROCESSOS_KPI_COLUMNS = [
  "id",
  "protocolo_ref",
  "status",
  "fase",
  "prazo",
  "tem_novo_andamento",
  "datajud_encerrado_tribunal",
  "djen_nova_comunicacao",
  "ultimo_retorno",
  "created_by",
  "atendido_por",
  "fila_lista",
].join(",");
