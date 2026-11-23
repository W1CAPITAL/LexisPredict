-- Read-only desktop analytics. Resolve company and privileges from auth.uid()
-- rather than accepting a tenant UUID supplied by a browser or desktop app.
-- Only these narrow, authenticated wrappers are exposed; existing internal
-- reporting functions and source tables retain their restrictive GRANT/RLS.
CREATE OR REPLACE FUNCTION public.lexis_desktop_historico_snapshot(
  p_periodo text DEFAULT 'esta_semana'
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_uid uuid := auth.uid(); v_empresa uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sessão necessária' USING ERRCODE='42501'; END IF;
  IF p_periodo NOT IN ('esta_semana','semana_passada','mes') THEN
    RAISE EXCEPTION 'Período inválido' USING ERRCODE='22023';
  END IF;
  SELECT u.empresa_id INTO v_empresa
  FROM public.usuarios u WHERE u.auth_user_id=v_uid AND u.empresa_id IS NOT NULL LIMIT 1;
  IF v_empresa IS NULL THEN RAISE EXCEPTION 'Organização não autorizada' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object(
    'empresa_id',v_empresa,
    'historico',public.lexis_atividade_kpis_periodo(v_empresa,p_periodo)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.lexis_desktop_relatorio_snapshot(
  p_periodo text DEFAULT 'mes', p_owner uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
 v_uid uuid := auth.uid();
 v_empresa uuid; v_cargo text; v_role text; v_is_supervisor boolean;
 v_owner uuid; v_portfolio jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sessão necessária' USING ERRCODE='42501'; END IF;
  IF p_periodo NOT IN ('esta_semana','semana_passada','mes') THEN
    RAISE EXCEPTION 'Período inválido' USING ERRCODE='22023';
  END IF;
  SELECT u.empresa_id,coalesce(u.cargo,''),coalesce(u.role,'')
  INTO v_empresa,v_cargo,v_role
  FROM public.usuarios u WHERE u.auth_user_id=v_uid AND u.empresa_id IS NOT NULL LIMIT 1;
  IF v_empresa IS NULL THEN RAISE EXCEPTION 'Organização não autorizada' USING ERRCODE='42501'; END IF;
  v_is_supervisor := lower(v_cargo||' '||v_role) ~ '(super[[:space:]]*admin|supervisor|supervis[aã]o)';
  -- An ordinary operator cannot use NULL or another user's ID to read
  -- the company-wide portfolio. Team-only diagnostics remain supervisor-only.
  IF NOT v_is_supervisor AND p_owner IS NOT NULL AND p_owner<>v_uid THEN
    RAISE EXCEPTION 'Escopo não autorizado' USING ERRCODE='42501';
  END IF;
  v_owner := CASE WHEN v_is_supervisor THEN p_owner ELSE v_uid END;
  SELECT to_jsonb(s) INTO v_portfolio
  FROM public.lexis_portfolio_snapshot(v_empresa,v_owner) s LIMIT 1;
  RETURN jsonb_build_object(
    'empresa_id',v_empresa,
    'portfolio',v_portfolio,
    'merito',public.lexis_merito_snapshot(v_empresa,v_owner),
    'retorno',public.lexis_retorno_snapshot(v_empresa,v_owner,30),
    'desfechos',public.lexis_contagem_encerramento_snapshot(v_empresa,v_owner),
    'historico',public.lexis_atividade_kpis_periodo(v_empresa,p_periodo),
    'encerramentos',CASE WHEN v_is_supervisor THEN public.lexis_encerramentos_kpis_periodo(v_empresa,p_periodo) ELSE NULL END,
    'trabalho',CASE WHEN v_is_supervisor THEN public.lexis_trabalho_interno_periodo(v_empresa,p_periodo) ELSE NULL END,
    'equipe',CASE WHEN v_is_supervisor THEN public.lexis_relatorio_equipe_periodo(v_empresa,p_periodo) ELSE NULL END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.lexis_desktop_supervisao_snapshot(
  p_periodo text DEFAULT 'esta_semana'
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
 v_uid uuid := auth.uid(); v_empresa uuid; v_cargo text; v_role text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sessão necessária' USING ERRCODE='42501'; END IF;
  IF p_periodo NOT IN ('esta_semana','semana_passada','mes') THEN
    RAISE EXCEPTION 'Período inválido' USING ERRCODE='22023';
  END IF;
  SELECT u.empresa_id,coalesce(u.cargo,''),coalesce(u.role,'')
  INTO v_empresa,v_cargo,v_role
  FROM public.usuarios u WHERE u.auth_user_id=v_uid AND u.empresa_id IS NOT NULL LIMIT 1;
  IF v_empresa IS NULL THEN RAISE EXCEPTION 'Organização não autorizada' USING ERRCODE='42501'; END IF;
  IF lower(v_cargo||' '||v_role) !~ '(super[[:space:]]*admin|supervisor|supervis[aã]o)' THEN
    RAISE EXCEPTION 'Somente Supervisor ou Superadmin' USING ERRCODE='42501';
  END IF;
  RETURN jsonb_build_object(
    'empresa_id',v_empresa,
    'carteira',public.lexis_supervisao_carteira_snapshot(v_empresa),
    'atividade',public.lexis_supervisao_atividade_snapshot(v_empresa,p_periodo),
    'status',public.lexis_supervisao_status_por_protocolo(v_empresa)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.lexis_desktop_historico_snapshot(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lexis_desktop_relatorio_snapshot(text,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lexis_desktop_supervisao_snapshot(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lexis_desktop_historico_snapshot(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.lexis_desktop_relatorio_snapshot(text,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.lexis_desktop_supervisao_snapshot(text) TO authenticated, service_role;
COMMENT ON FUNCTION public.lexis_desktop_historico_snapshot(text) IS 'Relatório humano do tenant autenticado, sem expor ID de empresa no cliente';
COMMENT ON FUNCTION public.lexis_desktop_relatorio_snapshot(text,uuid) IS 'Resumo do relatório desktop com escopo derivado de auth.uid e de perfil';
COMMENT ON FUNCTION public.lexis_desktop_supervisao_snapshot(text) IS 'KPIs da supervisão exclusivos de Supervisor ou Superadmin autenticado';
