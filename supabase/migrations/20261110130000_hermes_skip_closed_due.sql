-- Hermes: não consumir chamadas DJEN/DataJud para processos explicitamente encerrados.
-- Esta alteração preserva as reservas idempotentes e o escopo de empresa.
create or replace function public.hermes_claim_due_review(p_today date)
returns table (empresa_id uuid, processo_id bigint, due_on date)
language sql security invoker
set search_path = public
as $$
  with candidate as (
    select p.id, p.empresa_id, p.proximo_retorno
    from public.processos p
    left join public.hermes_return_reviews r
      on r.empresa_id = p.empresa_id
      and r.processo_id = p.id
      and r.due_on = p.proximo_retorno
    where p.empresa_id is not null
      and p.proximo_retorno <= p_today
      and upper(btrim(coalesce(p.status_interno, ''))) <> 'ENCERRADO'
      and (r.id is null
        or (r.state = 'unavailable' and r.attempted_at < now() - interval '4 hours')
        or (r.state = 'scanning' and r.attempted_at < now() - interval '15 minutes'))
    order by (case when p.proximo_retorno = p_today then 0 else 1 end),
             p.proximo_retorno asc, p.id asc
    limit 1
  ), claimed as (
    insert into public.hermes_return_reviews (empresa_id, processo_id, due_on, state, attempted_at)
    select c.empresa_id, c.id, c.proximo_retorno, 'scanning', now() from candidate c
    on conflict on constraint hermes_return_reviews_scope_due_unique
    do update set state = 'scanning', attempted_at = now()
    where (hermes_return_reviews.state = 'unavailable' and hermes_return_reviews.attempted_at < now() - interval '4 hours')
       or (hermes_return_reviews.state = 'scanning' and hermes_return_reviews.attempted_at < now() - interval '15 minutes')
    returning hermes_return_reviews.empresa_id, hermes_return_reviews.processo_id, hermes_return_reviews.due_on
  )
  select c.empresa_id, c.processo_id, c.due_on from claimed c;
$$;
revoke all on function public.hermes_claim_due_review(date) from public, anon, authenticated;
grant execute on function public.hermes_claim_due_review(date) to service_role;
