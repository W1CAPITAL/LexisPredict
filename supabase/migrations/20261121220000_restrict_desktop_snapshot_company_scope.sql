-- Keep the desktop summary available without shipping service_role credentials,
-- but never let a regular operator request another user's/company-wide aggregate.
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
  v_cargo text;
  v_role text;
  v_company_wide boolean := false;
  v_portfolio jsonb;
  v_merito jsonb;
  v_retorno jsonb;
begin
  if v_user is null then
    raise exception 'Sessão inválida' using errcode = '42501';
  end if;

  select
    u.empresa_id,
    regexp_replace(
      lower(translate(trim(coalesce(u.cargo, '')),
        'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç',
        'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc')),
      '[[:space:]]+', ' ', 'g'),
    regexp_replace(
      lower(translate(trim(coalesce(u.role, '')),
        'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç',
        'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc')),
      '[[:space:]]+', ' ', 'g')
  into v_empresa, v_cargo, v_role
  from public.usuarios u
  where u.auth_user_id = v_user
    and u.empresa_id is not null
  limit 1;

  if v_empresa is null then
    raise exception 'Conta sem organização autorizada' using errcode = '42501';
  end if;

  v_company_wide :=
    v_cargo in ('supervisor', 'supervisao', 'superadmin', 'super admin')
    or v_role in ('supervisor', 'supervisao', 'superadmin', 'super admin');

  if p_owner is null and not v_company_wide then
    raise exception 'Escopo empresarial exige Supervisor ou Superadmin'
      using errcode = '42501';
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
'Resumo desktop autenticado: escopo pessoal para qualquer usuário da empresa; escopo empresarial somente para Supervisor ou Superadmin.';
