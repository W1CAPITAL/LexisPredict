-- Hermes Company: dados agregados e verificáveis; nenhum nome de cliente ou sentença na reunião.
-- A síntese não substitui julgamento humano. API pública não possui SELECT nesta tabela.
create table if not exists public.hermes_office_daily (
  empresa_id uuid not null,
  day date not null,
  metrics jsonb not null default '{}'::jsonb,
  meeting_note text,
  meeting_engine text,
  meeting_status text not null default 'pending'
    check(meeting_status in ('pending','running','ready','unavailable')),
  meeting_claimed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (empresa_id, day)
);
alter table public.hermes_office_daily enable row level security;
revoke all on public.hermes_office_daily from public, anon, authenticated;
grant select,insert,update on public.hermes_office_daily to service_role;
create index if not exists hermes_office_daily_latest_idx
  on public.hermes_office_daily (empresa_id,day desc);

-- Cálculos set-based por empresa no servidor PostgreSQL, sem transferir carteira para o navegador.
create or replace function public.hermes_refresh_office_daily(p_day date)
returns integer language plpgsql security invoker set search_path=public
as $body$
declare v_count integer:=0;
begin
  with portfolio as (
    select p.empresa_id,
      count(*)::int total,
      count(*) filter(where upper(trim(coalesce(p.status_interno,p.status,''))) not in ('ENCERRADO','FINALIZADO','ARQUIVADO'))::int active,
      count(*) filter(where p.proximo_retorno<=p_day and
         upper(trim(coalesce(p.status_interno,p.status,''))) not in ('ENCERRADO','FINALIZADO','ARQUIVADO'))::int overdue,
      count(*) filter(where (p.tem_atualizacao_pos_retorno or p.djen_nova_comunicacao) and
         upper(trim(coalesce(p.status_interno,p.status,''))) not in ('ENCERRADO','FINALIZADO','ARQUIVADO'))::int alerts,
      count(*) filter(where upper(trim(coalesce(p.status_interno,p.status,''))) not in ('ENCERRADO','FINALIZADO','ARQUIVADO') and
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
revoke all on function public.hermes_refresh_office_daily(date) from public,anon,authenticated;
grant execute on function public.hermes_refresh_office_daily(date) to service_role;

-- Concorrência segura: no máximo uma síntese IA por empresa/dia.
create or replace function public.hermes_claim_office_meeting(p_empresa uuid,p_day date)
returns jsonb language plpgsql security invoker set search_path=public
as $body$
declare v_metrics jsonb;
begin
  update public.hermes_office_daily d
  set meeting_status='running',meeting_claimed_at=now()
  where d.empresa_id=p_empresa and d.day=p_day
    and (d.meeting_status='pending' or
      (d.meeting_status='running' and d.meeting_claimed_at<now()-interval '5 minutes'))
  returning d.metrics into v_metrics;
  return v_metrics;
end
$body$;
revoke all on function public.hermes_claim_office_meeting(uuid,date) from public,anon,authenticated;
grant execute on function public.hermes_claim_office_meeting(uuid,date) to service_role;

-- O cron de snapshot executa cálculo barato a cada quatro horas, sem chamadas externas.
do $schedule$
begin
 if not exists (select 1 from cron.job where jobname='lexis-hermes-company-snapshot') then
   perform cron.schedule('lexis-hermes-company-snapshot','15 10,14,18,22 * * *',
     'select public.hermes_refresh_office_daily((now() at time zone ''America/Sao_Paulo'')::date);');
 end if;
end
$schedule$;
