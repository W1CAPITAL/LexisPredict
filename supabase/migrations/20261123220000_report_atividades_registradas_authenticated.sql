-- Aggregate the registered-task table through the authenticated report wrapper.
-- The helper is intentionally private; the wrapper derives tenant and owner
-- from auth.uid() and the user's supervisor role.
CREATE OR REPLACE FUNCTION public.lexis_desktop_atividades_registradas_snapshot(
  p_empresa uuid,
  p_owner uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $function$
WITH base AS (
  SELECT responsavel_auth_user_id,processo_id,protocolo_ref,contato_cliente_confirmado
  FROM public.tarefas_realizadas
  WHERE empresa_id=p_empresa
    AND (p_owner IS NULL OR responsavel_auth_user_id=p_owner)
),
por_responsavel AS (
  SELECT
    responsavel_auth_user_id,
    count(*)::integer AS registros,
    count(*) FILTER (WHERE contato_cliente_confirmado IS TRUE)::integer AS contatos_marcados,
    count(*) FILTER (
      WHERE processo_id IS NULL
        AND nullif(regexp_replace(coalesce(protocolo_ref,''),'[^0-9]','','g'),'') IS NULL
    )::integer AS sem_referencia,
    count(DISTINCT CASE
      WHEN processo_id IS NOT NULL THEN 'id:'||processo_id::text
      WHEN nullif(regexp_replace(coalesce(protocolo_ref,''),'[^0-9]','','g'),'') IS NOT NULL
        THEN 'cnj:'||regexp_replace(coalesce(protocolo_ref,''),'[^0-9]','','g')
      ELSE NULL
    END)::integer AS processos
  FROM base
  WHERE responsavel_auth_user_id IS NOT NULL
  GROUP BY responsavel_auth_user_id
)
SELECT jsonb_build_object(
  'total',(SELECT count(*)::integer FROM base),
  'porResponsavel',coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'userId',responsavel_auth_user_id,
      'registros',registros,
      'processos',processos,
      'contatosMarcados',contatos_marcados,
      'semReferencia',sem_referencia
    ) ORDER BY registros DESC,responsavel_auth_user_id)
    FROM por_responsavel
  ),'[]'::jsonb)
);
$function$;

-- Do not allow browser/desktop clients to supply an arbitrary company ID.
-- Only the existing authenticated wrapper can invoke this helper.
REVOKE ALL ON FUNCTION public.lexis_desktop_atividades_registradas_snapshot(uuid,uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.lexis_desktop_relatorio_snapshot(
  p_periodo text DEFAULT 'mes',
  p_owner uuid DEFAULT NULL
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
  v_is_supervisor boolean;
  v_owner uuid;
  v_portfolio jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sessão necessária' USING ERRCODE='42501';
  END IF;
  IF p_periodo NOT IN ('esta_semana','semana_passada','mes') THEN
    RAISE EXCEPTION 'Período inválido' USING ERRCODE='22023';
  END IF;

  SELECT u.empresa_id,coalesce(u.cargo,''),coalesce(u.role,'')
    INTO v_empresa,v_cargo,v_role
  FROM public.usuarios u
  WHERE u.auth_user_id=v_uid AND u.empresa_id IS NOT NULL
  LIMIT 1;

  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'Organização não autorizada' USING ERRCODE='42501';
  END IF;

  v_is_supervisor := lower(v_cargo||' '||v_role) ~ '(super[[:space:]]*admin|supervisor|supervis[aã]o)';

  IF NOT v_is_supervisor AND p_owner IS NOT NULL AND p_owner<>v_uid THEN
    RAISE EXCEPTION 'Escopo não autorizado' USING ERRCODE='42501';
  END IF;

  v_owner := CASE WHEN v_is_supervisor THEN p_owner ELSE v_uid END;

  SELECT to_jsonb(s) INTO v_portfolio
  FROM public.lexis_portfolio_snapshot(v_empresa,v_owner) s
  LIMIT 1;

  RETURN jsonb_build_object(
    'empresa_id',v_empresa,
    'portfolio',v_portfolio,
    'merito',public.lexis_merito_snapshot(v_empresa,v_owner),
    'retorno',public.lexis_retorno_snapshot(v_empresa,v_owner,30),
    'desfechos',public.lexis_contagem_encerramento_snapshot(v_empresa,v_owner),
    'historico',public.lexis_atividade_kpis_periodo(v_empresa,p_periodo),
    'encerramentos',CASE WHEN v_is_supervisor THEN public.lexis_encerramentos_kpis_periodo(v_empresa,p_periodo) ELSE NULL END,
    'trabalho',CASE WHEN v_is_supervisor THEN public.lexis_trabalho_interno_periodo(v_empresa,p_periodo) ELSE NULL END,
    'equipe',CASE WHEN v_is_supervisor THEN public.lexis_relatorio_equipe_periodo(v_empresa,p_periodo) ELSE NULL END,
    'atividadesRegistradas',public.lexis_desktop_atividades_registradas_snapshot(v_empresa,v_owner)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.lexis_desktop_relatorio_snapshot(text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lexis_desktop_relatorio_snapshot(text,uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.lexis_desktop_atividades_registradas_snapshot(uuid,uuid) IS 'Agrega tarefas_realizadas por usuário; execução apenas pelo wrapper autenticado do relatório';
COMMENT ON FUNCTION public.lexis_desktop_relatorio_snapshot(text,uuid) IS 'Relatório desktop com carteira, equipe e tarefas registradas agregadas, escopo derivado de auth.uid';
