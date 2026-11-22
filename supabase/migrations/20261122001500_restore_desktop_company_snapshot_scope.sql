-- /processos is an authenticated company workspace for every member of the
-- organization. Keep its desktop indicators coherent with the company list
-- while deriving the tenant exclusively from auth.uid().
--
-- This replaces the role-only null-owner gate introduced by
-- 20261121220000_restrict_desktop_snapshot_company_scope.sql. It does not
-- permit another owner or a caller-selected company.
create or replace function public.lexis_desktop_portfolio_snapshot(
  p_owner uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
declare
  v_user uuid := auth.uid();
  v_empresa uuid;
  v_portfolio jsonb;
  v_merito jsonb;
  v_retorno jsonb;
begin
  if v_user is null then
    raise exception 'Sessão inválida' using errcode = '42501';
  end if;

  select u.empresa_id
  into v_empresa
  from public.usuarios u
  where u.auth_user_id = v_user
    and u.empresa_id is not null
  limit 1;

  if v_empresa is null then
    raise exception 'Conta sem organização autorizada' using errcode = '42501';
  end if;

  if p_owner is not null and p_owner <> v_user then
    raise exception 'Escopo de usuário não autorizado' using errcode = '42501';
  end if;

  select to_jsonb(r) into v_portfolio
  from public.lexis_portfolio_snapshot(v_empresa, p_owner) as r
  limit 1;

  if v_portfolio is null then
    raise exception 'Resumo da carteira indisponível' using errcode = 'P0001';
  end if;

  select public.lexis_merito_snapshot(v_empresa, p_owner) into v_merito;
  select public.lexis_retorno_snapshot(v_empresa, p_owner, 30) into v_retorno;

  return jsonb_build_object(
    'empresa_id', v_empresa,
    'portfolio', v_portfolio,
    'merito', v_merito,
    'retorno', v_retorno
  );
end;
$function$;

revoke all on function public.lexis_desktop_portfolio_snapshot(uuid) from public;
revoke all on function public.lexis_desktop_portfolio_snapshot(uuid) from anon;
grant execute on function public.lexis_desktop_portfolio_snapshot(uuid) to authenticated, service_role;

comment on function public.lexis_desktop_portfolio_snapshot(uuid) is
'Resumo desktop autenticado: empresa derivada do JWT; p_owner nulo representa a carteira da própria empresa e outro usuário é recusado.';
