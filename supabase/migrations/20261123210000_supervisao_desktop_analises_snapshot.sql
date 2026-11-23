-- Keep raw analytics rows private to their owner. The desktop supervisor
-- screen receives only company-level aggregates through an authenticated RPC.
CREATE OR REPLACE FUNCTION public.lexis_supervisao_analises_snapshot(
  p_empresa uuid,
  p_inicio date,
  p_fim date
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $function$
WITH analises AS (
  SELECT processo_id,categoria,data_atividade,metadata
  FROM public.registros_trabalho_analitico
  WHERE empresa_id=p_empresa
),
tarefas AS (
  SELECT responsavel_auth_user_id,data_realizacao,contato_cliente_confirmado
  FROM public.tarefas_realizadas
  WHERE empresa_id=p_empresa
),
tarefas_por_pessoa AS (
  SELECT
    responsavel_auth_user_id,
    count(*)::integer AS total,
    count(*) FILTER (WHERE data_realizacao BETWEEN p_inicio AND p_fim)::integer AS periodo
  FROM tarefas
  GROUP BY responsavel_auth_user_id
)
SELECT jsonb_build_object(
  'totalRegistros',(SELECT count(*)::integer FROM analises),
  'processosAnalisados',(SELECT count(DISTINCT processo_id)::integer FROM analises
    WHERE processo_id IS NOT NULL
      AND categoria IN ('auditoria_sistemica','auditoria_documental','triagem_replica_provas','dossie_individual','investigacao_get','investigacao_externa')),
  'processosComTrabalho',(SELECT count(DISTINCT processo_id)::integer FROM analises WHERE processo_id IS NOT NULL),
  'atendidosInternamenteNoPeriodo',(SELECT count(DISTINCT processo_id)::integer FROM analises
    WHERE processo_id IS NOT NULL
      AND data_atividade BETWEEN p_inicio AND p_fim
      AND categoria NOT IN ('auditoria_sistemica','historico_encerramento_lote_id_davi')
      AND metadata->>'data_original_ausente' IS DISTINCT FROM 'true'),
  'auditoriaSistemica',(SELECT count(*)::integer FROM analises WHERE categoria='auditoria_sistemica'),
  'auditoriaDocumental',(SELECT count(*)::integer FROM analises WHERE categoria='auditoria_documental'),
  'triagemReplicaProvas',(SELECT count(*)::integer FROM analises WHERE categoria='triagem_replica_provas'),
  'dossiesIndividuais',(SELECT count(*)::integer FROM analises WHERE categoria='dossie_individual'),
  'investigacoesExternas',(SELECT count(*)::integer FROM analises WHERE categoria IN ('investigacao_get','investigacao_externa')),
  'projetos',(SELECT count(*)::integer FROM analises WHERE categoria='entrega_projeto'),
  'historicoAtendimentosLegados',(SELECT count(*)::integer FROM analises WHERE categoria IN ('historico_atendimento_id_davi','atendimento_por_perfil_davi')),
  'historicoEdicoesLegadas',(SELECT count(*)::integer FROM analises WHERE categoria IN ('historico_edicao_id_davi','edicao_por_nome_davi')),
  'encerramentosImportados',(SELECT count(*)::integer FROM analises WHERE categoria='historico_encerramento_lote_id_davi'),
  'tarefasConcluidas',(SELECT count(*)::integer FROM tarefas),
  'tarefasConcluidasPeriodo',(SELECT count(*)::integer FROM tarefas WHERE data_realizacao BETWEEN p_inicio AND p_fim),
  'tarefasUsuarioConcluidas',0,
  'tarefasUsuarioPeriodo',0,
  'contatosDeclaradosPeriodo',(SELECT count(*)::integer FROM tarefas
    WHERE data_realizacao BETWEEN p_inicio AND p_fim AND contato_cliente_confirmado IS TRUE),
  'tarefasPorPessoa',coalesce((
    SELECT jsonb_agg(
      jsonb_build_object('nome',coalesce(u.nome,'Usuário'),'total',tp.total,'periodo',tp.periodo)
      ORDER BY tp.periodo DESC,tp.total DESC,coalesce(u.nome,'')
    )
    FROM tarefas_por_pessoa tp
    LEFT JOIN public.usuarios u
      ON u.auth_user_id=tp.responsavel_auth_user_id
     AND u.empresa_id=p_empresa
  ),'[]'::jsonb),
  'responsavel','Equipe da empresa',
  'consultaEm',now()
);
$function$;

-- The helper accepts a tenant ID only for internal use by the definer wrapper.
-- Do not expose it as a direct authenticated RPC.
REVOKE ALL ON FUNCTION public.lexis_supervisao_analises_snapshot(uuid,date,date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.lexis_desktop_supervisao_snapshot(
  p_periodo text DEFAULT 'esta_semana'::text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_empresa uuid;
  v_cargo text;
  v_role text;
  v_periodo text := coalesce(p_periodo,'esta_semana');
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_inicio date;
  v_fim date;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sessão autenticada obrigatória.' USING ERRCODE='42501';
  END IF;

  SELECT u.empresa_id,u.cargo,u.role
    INTO v_empresa,v_cargo,v_role
  FROM public.usuarios u
  WHERE u.auth_user_id=v_uid
  LIMIT 1;

  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'Organização não encontrada para a sessão.' USING ERRCODE='42501';
  END IF;

  IF lower(coalesce(v_cargo,'')||' '||coalesce(v_role,'')) !~ '(super[[:space:]]*admin|supervisor|supervis[aã]o)' THEN
    RAISE EXCEPTION 'Somente Supervisor ou Superadmin pode acessar a supervisão.' USING ERRCODE='42501';
  END IF;

  IF v_periodo NOT IN ('esta_semana','semana_passada','mes') THEN
    RAISE EXCEPTION 'Período inválido.' USING ERRCODE='22023';
  END IF;

  IF v_periodo='semana_passada' THEN
    v_inicio:=date_trunc('week',v_hoje::timestamp)::date-7;
    v_fim:=date_trunc('week',v_hoje::timestamp)::date-1;
  ELSIF v_periodo='mes' THEN
    v_inicio:=date_trunc('month',v_hoje::timestamp)::date;
    v_fim:=v_hoje;
  ELSE
    v_inicio:=date_trunc('week',v_hoje::timestamp)::date;
    v_fim:=v_inicio+6;
  END IF;

  RETURN jsonb_build_object(
    'empresa_id',v_empresa,
    'carteira',public.lexis_supervisao_carteira_snapshot(v_empresa),
    'atividade',public.lexis_supervisao_atividade_snapshot(v_empresa,v_periodo),
    'status',public.lexis_supervisao_status_por_protocolo(v_empresa),
    'analises',public.lexis_supervisao_analises_snapshot(v_empresa,v_inicio,v_fim)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.lexis_desktop_supervisao_snapshot(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lexis_desktop_supervisao_snapshot(text) TO authenticated, service_role;
