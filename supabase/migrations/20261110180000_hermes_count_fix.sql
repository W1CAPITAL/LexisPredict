-- Snapshot idêntico à fila oficial: não contar encerrados no JSON dados.situacao,
-- nem no status principal ou status_interno. Não atualiza o cadastro de processos.
create or replace function public.hermes_refresh_office_daily(p_day date)
returns integer language plpgsql security invoker set search_path=public
as $body$
declare v_count integer:=0;
begin
  with portfolio as (
    select p.empresa_id,
      count(*)::int total,
      count(*) filter(where (upper(trim(coalesce(p.status_interno,''))) not in ('ENCERRADO','FINALIZADO','ARQUIVADO','EXTINTO') and
        upper(trim(coalesce(p.status,''))) not in ('ENCERRADO','FINALIZADO','ARQUIVADO','EXTINTO') and
        upper(trim(coalesce(p.dados->>'situacao',''))) not in ('ENCERRADO','FINALIZADO','ARQUIVADO','EXTINTO') and
        upper(trim(coalesce(p.dados->>'statusManual',''))) not in ('ENCERRADO','FINALIZADO','ARQUIVADO','EXTINTO')))::int active,
      count(*) filter(where p.proximo_retorno<=p_day and
         (upper(trim(coalesce(p.status_interno,''))) not in ('ENCERRADO','FINALIZADO','ARQUIVADO','EXTINTO') and
        upper(trim(coalesce(p.status,''))) not in ('ENCERRADO','FINALIZADO','ARQUIVADO','EXTINTO') and
        upper(trim(coalesce(p.dados->>'situacao',''))) not in ('ENCERRADO','FINALIZADO','ARQUIVADO','EXTINTO') and
        upper(trim(coalesce(p.dados->>'statusManual',''))) not in ('ENCERRADO','FINALIZADO','ARQUIVADO','EXTINTO')))::int overdue,
      count(*) filter(where (p.tem_atualizacao_pos_retorno or p.djen_nova_comunicacao) and
         (upper(trim(coalesce(p.status_interno,''))) not in ('ENCERRADO','FINALIZADO','ARQUIVADO','EXTINTO') and
        upper(trim(coalesce(p.status,''))) not in ('ENCERRADO','FINALIZADO','ARQUIVADO','EXTINTO') and
        upper(trim(coalesce(p.dados->>'situacao',''))) not in ('ENCERRADO','FINALIZADO','ARQUIVADO','EXTINTO') and
        upper(trim(coalesce(p.dados->>'statusManual',''))) not in ('ENCERRADO','FINALIZADO','ARQUIVADO','EXTINTO')))::int alerts,
      count(*) filter(where (upper(trim(coalesce(p.status_interno,''))) not in ('ENCERRADO','FINALIZADO','ARQUIVADO','EXTINTO') and
        upper(trim(coalesce(p.status,''))) not in ('ENCERRADO','FINALIZADO','ARQUIVADO','EXTINTO') and
        upper(trim(coalesce(p.dados->>'situacao',''))) not in ('ENCERRADO','FINALIZADO','ARQUIVADO','EXTINTO') and
        upper(trim(coalesce(p.dados->>'statusManual',''))) not in ('ENCERRADO','FINALIZADO','ARQUIVADO','EXTINTO')) and
         (greatest(p.djen_consultado_em,p.datajud_consultado_em) is null or
          greatest(p.djen_consultado_em,p.datajud_consultado_em)<(now()-interval '21 days')))::int stale_sources
    from public.processos p where p.empresa_id is not null group by p.empresa_id
  ), reviews as (
    select empresa_id,
      count(*) filter(where state='ready')::int ready_reviews,
      count(*) filter(where state='unavailable')::int unavailable_reviews,
      count(*) filter(where state='ready' and priority_score>=90)::int critical_reviews,
      count(*) filter(where state='ready' and coalesce(message_draft,'')<>'')::int draft_messages,
      count(*) filter(where (djen_ok or datajud_ok))::int checked_sources
    from public.hermes_return_reviews
    where attempted_at>=now()-interval '30 days'
    group by empresa_id
  ), work as (
    select empresa_id,count(*)::int activities,
      count(*) filter(where contato_cliente_confirmado=true)::int contacts
    from public.tarefas_realizadas
    where data_realizacao>=p_day-interval '30 days' and data_realizacao<=p_day
    group by empresa_id
  ), inserted as (
    insert into public.hermes_office_daily(empresa_id,day,metrics,updated_at)
    select p.empresa_id,p_day,jsonb_build_object(
      'total',p.total,'active',p.active,'overdue',p.overdue,'alerts',p.alerts,
      'staleSources',p.stale_sources,
      'readyReviews',coalesce(r.ready_reviews,0),
      'unavailableReviews',coalesce(r.unavailable_reviews,0),
      'criticalReviews',coalesce(r.critical_reviews,0),
      'draftMessages',coalesce(r.draft_messages,0),
      'checkedSources30d',coalesce(r.checked_sources,0),
      'completedActivities30d',coalesce(w.activities,0),
      'contacts30d',coalesce(w.contacts,0)
    ),now()
    from portfolio p
    left join reviews r on r.empresa_id=p.empresa_id
    left join work w on w.empresa_id=p.empresa_id
    on conflict(empresa_id,day) do update
      set metrics=excluded.metrics,updated_at=now()
    returning 1
  )
  select count(*) into v_count from inserted;
  return v_count;
end
$body$;
select public.hermes_refresh_office_daily((now() at time zone 'America/Sao_Paulo')::date);
