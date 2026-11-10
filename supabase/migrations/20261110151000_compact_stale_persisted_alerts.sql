-- Limpeza conservadora: somente "persisted" repetido com mais de 90 dias.
-- Preserva o registro mais novo por empresa/processo/fonte e todos os eventos
-- de origem (raised/acked/scan), sem apagar status ou prova judicial.
create index if not exists alert_events_retention_key_idx
  on public.alert_events (empresa_id, protocolo_ref, event_type, source, created_at desc, id desc);

create or replace function public.compact_stale_persisted_alerts(p_limit integer default 1500)
returns integer language plpgsql security invoker set search_path = public
as $function$
declare
  removed_count integer := 0;
begin
  with redundant as (
    select e.id
    from public.alert_events e
    where e.event_type = 'persisted'
      and e.created_at < now() - interval '90 days'
      and exists (
        select 1 from public.alert_events newer
        where newer.empresa_id = e.empresa_id
          and newer.protocolo_ref is not distinct from e.protocolo_ref
          and newer.event_type = e.event_type
          and newer.source is not distinct from e.source
          and (newer.created_at, newer.id) > (e.created_at, e.id)
      )
    order by e.created_at asc, e.id asc
    limit greatest(1, least(coalesce(p_limit, 1500), 5000))
  )
  delete from public.alert_events ae
  using redundant r
  where ae.id = r.id;
  get diagnostics removed_count = row_count;
  return removed_count;
end
$function$;
revoke all on function public.compact_stale_persisted_alerts(integer) from public, anon, authenticated;
grant execute on function public.compact_stale_persisted_alerts(integer) to service_role;

-- Limpeza futura sem precisar abrir o aplicativo. O job jamais lê publicações
-- judiciais ou modifica flags atuais dos processos.
do $schedule$
begin
  if not exists (select 1 from cron.job where jobname = 'lexis-alert-persisted-retention') then
    perform cron.schedule('lexis-alert-persisted-retention', '45 6 * * *',
      'select public.compact_stale_persisted_alerts(5000);');
  end if;
end
$schedule$;
