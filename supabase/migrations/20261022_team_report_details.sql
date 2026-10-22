-- Relatório da equipe: contagem independente por responsável e trilha de evidências.
-- Somente service_role pode executar. A página valida a sessão/empresa antes do RPC.
CREATE OR REPLACE FUNCTION public.lexis_relatorio_equipe_periodo(
  p_empresa uuid, p_periodo text DEFAULT 'mes'
)
RETURNS jsonb LANGUAGE sql STABLE
SET search_path TO 'public'
AS $fn$
WITH periodo AS (
 SELECT
 CASE WHEN p_periodo='semana_passada' THEN date_trunc('week',now() AT TIME ZONE 'America/Sao_Paulo')::date-7
      WHEN p_periodo='mes' THEN date_trunc('month',now() AT TIME ZONE 'America/Sao_Paulo')::date
      ELSE date_trunc('week',now() AT TIME ZONE 'America/Sao_Paulo')::date END AS inicio,
 CASE WHEN p_periodo='semana_passada' THEN date_trunc('week',now() AT TIME ZONE 'America/Sao_Paulo')::date-1
      WHEN p_periodo='mes' THEN (now() AT TIME ZONE 'America/Sao_Paulo')::date
      ELSE date_trunc('week',now() AT TIME ZONE 'America/Sao_Paulo')::date+6 END AS fim
), membros AS (
 SELECT u.id, u.auth_user_id, u.nome, u.cargo
 FROM public.usuarios u
 WHERE u.empresa_id=p_empresa AND u.auth_user_id IS NOT NULL
 AND upper(trim(coalesce(u.nome,''))) NOT IN ('W1 CONTROL','SISTEMA INTERNO','SUPERVISÃO','SUPERVISAO','GET')
 AND trim(coalesce(u.nome,'')) <> ''
), eventos AS (
 SELECT l.auth_user_id, l.action, l.protocolo_ref,
        regexp_replace(coalesce(l.protocolo_ref,''),'[^0-9]','','g') AS cnj,
        l.detalhes
 FROM public.auditoria_logs_app l
 CROSS JOIN periodo t
 WHERE l.empresa_id=p_empresa
 AND l.created_at >= (t.inicio::timestamp AT TIME ZONE 'America/Sao_Paulo')
 AND l.created_at < ((t.fim+1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
 AND l.action IN ('atendimento','edicao','encerramento')
), eventos_pessoa AS (
 SELECT e.auth_user_id,
 count(*) FILTER(WHERE length(e.cnj)=20
    AND (e.action='atendimento' OR (e.action='encerramento' AND e.detalhes ? 'event_id'))) AS atendimentos_eventos,
 count(DISTINCT e.cnj) FILTER(WHERE length(e.cnj)=20
    AND (e.action='atendimento' OR (e.action='encerramento' AND e.detalhes ? 'event_id'))) AS atendimentos_processos,
 count(*) FILTER(WHERE length(e.cnj)=20 AND e.action='edicao') AS edicoes_eventos,
 count(DISTINCT e.cnj) FILTER(WHERE length(e.cnj)=20 AND e.action='edicao') AS edicoes_processos,
 count(*) FILTER(WHERE length(e.cnj)=20 AND e.action='encerramento' AND e.detalhes ? 'event_id') AS encerramentos_eventos,
 count(DISTINCT e.cnj) FILTER(WHERE length(e.cnj)=20 AND e.action='encerramento' AND e.detalhes ? 'event_id') AS encerramentos_processos
 FROM eventos e GROUP BY e.auth_user_id
), carteira AS (
 SELECT m.auth_user_id,
 count(p.id) AS total,
 count(p.id) FILTER(WHERE p.status='Encerrado' OR upper(coalesce(p.status_interno,''))='ENCERRADO') AS encerrados,
 count(p.id) FILTER(WHERE p.status IS DISTINCT FROM 'Encerrado' AND upper(coalesce(p.status_interno,'')) <> 'ENCERRADO') AS ativos
 FROM membros m LEFT JOIN public.processos p ON p.empresa_id=p_empresa
      AND p.created_by IN(m.auth_user_id,m.id)
 GROUP BY m.auth_user_id
), tarefas AS (
 SELECT r.id,r.responsavel_auth_user_id,r.titulo,r.descricao,r.categoria,r.data_realizacao,
        r.contato_cliente_confirmado,r.protocolo_ref,r.created_at,r.origem
 FROM public.tarefas_realizadas r CROSS JOIN periodo t
 WHERE r.empresa_id=p_empresa AND r.data_realizacao BETWEEN t.inicio AND t.fim
), tarefas_ag AS (
 SELECT responsavel_auth_user_id,
 count(*) AS registros,
 count(*) FILTER (WHERE categoria='atendimento') AS contatos_registrados,
 count(*) FILTER (WHERE categoria='atendimento' AND contato_cliente_confirmado) AS contatos_declarados,
 count(*) FILTER (WHERE categoria<>'atendimento') AS atividades_internas,
 count(DISTINCT nullif(regexp_replace(coalesce(protocolo_ref,''),'[^0-9]','','g'),'')) AS processos_identificados
 FROM tarefas GROUP BY responsavel_auth_user_id
), trabalho AS (
 SELECT r.responsavel_auth_user_id,r.categoria,r.origem,r.descricao,r.data_atividade,r.created_at,
        r.processo_id,r.protocolo_ref,r.nivel_conferencia
 FROM public.registros_trabalho_analitico r CROSS JOIN periodo t
 WHERE r.empresa_id=p_empresa
 AND r.data_atividade BETWEEN t.inicio AND t.fim
 AND r.categoria <> 'atendimento_interno_teste'
), trabalho_ag AS (
 SELECT responsavel_auth_user_id,
 count(*) AS registros,
 count(DISTINCT processo_id) AS processos_analisados,
 count(*) FILTER(WHERE categoria IN ('entrega_projeto','dossie_individual','investigacao_get','investigacao_externa')) AS registros_de_entrega,
 count(*) FILTER(WHERE categoria='auditoria_sistemica') AS verificacoes_em_lote
 FROM trabalho GROUP BY responsavel_auth_user_id
), tarefa_ranking AS (
 SELECT t.*, row_number() OVER(
 PARTITION BY t.responsavel_auth_user_id
 ORDER BY CASE WHEN t.categoria='atendimento' THEN 1 ELSE 0 END,
 t.data_realizacao DESC,t.created_at DESC,t.id
 ) AS rn
 FROM tarefas t
), entregas_ranking AS (
 SELECT x.*,row_number() OVER(
 PARTITION BY x.responsavel_auth_user_id
 ORDER BY x.data_atividade DESC,x.created_at DESC
 ) AS rn
 FROM (
 SELECT DISTINCT ON (responsavel_auth_user_id,categoria,origem)
 responsavel_auth_user_id,categoria,origem,descricao,data_atividade,created_at,nivel_conferencia
 FROM trabalho WHERE categoria IN ('entrega_projeto','dossie_individual','investigacao_get','investigacao_externa','triagem_replica_provas')
 ORDER BY responsavel_auth_user_id,categoria,origem,data_atividade DESC,created_at DESC
 ) x
), resultado AS (
 SELECT m.auth_user_id,m.nome,m.cargo,
 coalesce(c.total,0) carteira_total,coalesce(c.ativos,0) carteira_ativos,coalesce(c.encerrados,0) carteira_encerrados,
 coalesce(ev.atendimentos_processos,0) atendimentos_processos,coalesce(ev.atendimentos_eventos,0) atendimentos_eventos,
 coalesce(ev.edicoes_processos,0) edicoes_processos,coalesce(ev.edicoes_eventos,0) edicoes_eventos,
 coalesce(ev.encerramentos_processos,0) encerramentos_processos,coalesce(ev.encerramentos_eventos,0) encerramentos_eventos,
 coalesce(ta.registros,0) atividades_registros,
 coalesce(ta.contatos_registrados,0) atividades_contato,
 coalesce(ta.contatos_declarados,0) contatos_declarados,
 coalesce(ta.atividades_internas,0) atividades_internas,
 coalesce(ta.processos_identificados,0) atividades_processos,
 coalesce(tr.registros,0) auditorias_registros,
 coalesce(tr.processos_analisados,0) auditorias_processos,
 coalesce(tr.registros_de_entrega,0) entregas_registros,
 coalesce(tr.verificacoes_em_lote,0) verificacoes_em_lote,
 coalesce((
   SELECT jsonb_agg(jsonb_build_object('categoria',v.categoria,'registros',v.registros) ORDER BY v.registros DESC,v.categoria)
   FROM (SELECT categoria,count(*) AS registros FROM tarefas t WHERE t.responsavel_auth_user_id=m.auth_user_id GROUP BY categoria) v
 ),'[]'::jsonb) AS tipos_tarefas,
 coalesce((
   SELECT jsonb_agg(jsonb_build_object('categoria',v.categoria,'registros',v.registros) ORDER BY v.registros DESC,v.categoria)
   FROM (SELECT categoria,count(*) AS registros FROM trabalho w WHERE w.responsavel_auth_user_id=m.auth_user_id GROUP BY categoria) v
 ),'[]'::jsonb) AS tipos_auditoria,
 coalesce((
   SELECT jsonb_agg(jsonb_build_object('categoria',v.categoria,'titulo',left(v.titulo,170),'data',v.data_realizacao,
    'detalhe',CASE WHEN v.categoria='atendimento' THEN '' ELSE left(coalesce(v.descricao,''),290) END,
    'protocolo',v.protocolo_ref,
    'contatoConfirmado',v.contato_cliente_confirmado) ORDER BY v.rn)
   FROM tarefa_ranking v WHERE v.responsavel_auth_user_id=m.auth_user_id AND v.rn<=7
 ),'[]'::jsonb) AS tarefas_recentes,
 coalesce((
   SELECT jsonb_agg(jsonb_build_object('categoria',v.categoria,'titulo',left(coalesce(nullif(v.origem,''),v.categoria),155),
      'data',v.data_atividade,'detalhe',left(coalesce(v.descricao,''),300),'conferencia',v.nivel_conferencia) ORDER BY v.rn)
   FROM entregas_ranking v WHERE v.responsavel_auth_user_id=m.auth_user_id AND v.rn<=8
 ),'[]'::jsonb) AS entregas_recentes
 FROM membros m
 LEFT JOIN carteira c ON c.auth_user_id=m.auth_user_id
 LEFT JOIN eventos_pessoa ev ON ev.auth_user_id=m.auth_user_id
 LEFT JOIN tarefas_ag ta ON ta.responsavel_auth_user_id=m.auth_user_id
 LEFT JOIN trabalho_ag tr ON tr.responsavel_auth_user_id=m.auth_user_id
)
SELECT jsonb_build_object(
 'periodo',p_periodo,
 'inicio',(SELECT inicio FROM periodo),
 'fim',(SELECT fim FROM periodo),
 'pessoas',coalesce((SELECT jsonb_agg(
 jsonb_build_object(
 'userId',r.auth_user_id,'nome',r.nome,'cargo',r.cargo,
 'carteira',jsonb_build_object('total',r.carteira_total,'ativos',r.carteira_ativos,'encerrados',r.carteira_encerrados),
 'atendimentos',jsonb_build_object('processos',r.atendimentos_processos,'eventos',r.atendimentos_eventos),
 'edicoes',jsonb_build_object('processos',r.edicoes_processos,'eventos',r.edicoes_eventos),
 'encerramentos',jsonb_build_object('processos',r.encerramentos_processos,'eventos',r.encerramentos_eventos),
 'atividades',jsonb_build_object('registros',r.atividades_registros,'contato',r.atividades_contato,
 'contatosDeclarados',r.contatos_declarados,'internas',r.atividades_internas,'processos',r.atividades_processos,'categorias',r.tipos_tarefas,'recentes',r.tarefas_recentes),
 'trabalho',jsonb_build_object('registros',r.auditorias_registros,'processos',r.auditorias_processos,
 'entregas',r.entregas_registros,'verificacoesLote',r.verificacoes_em_lote,'categorias',r.tipos_auditoria,'entregasRecentes',r.entregas_recentes)
 ) ORDER BY CASE WHEN upper(r.nome) LIKE 'DAVI %' THEN 0 WHEN upper(r.nome)='KRIS' THEN 1 WHEN upper(r.nome)='ADRIANA' THEN 2 ELSE 3 END,r.nome)
 FROM resultado r),'[]'::jsonb),
 'nota','Atendimentos, atividades registradas e análises/auditorias são trilhas diferentes; um mesmo caso pode aparecer em mais de uma e os totais não devem ser somados. Trabalho em lote não equivale a clientes contatados.',
 'consultadoEm',now()
);
$fn$;
REVOKE ALL ON FUNCTION public.lexis_relatorio_equipe_periodo(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lexis_relatorio_equipe_periodo(uuid,text) TO service_role;
