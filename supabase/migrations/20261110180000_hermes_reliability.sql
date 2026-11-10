-- Reusa a mesma regra de carteiras abertas em Hermes, fila, scanner e relatório.
create or replace function public.hermes_refresh_office_daily(p_day date)
returns integer language plpgsql security invoker set search_path=public
as $body$
declare v_count integer:=0;
begin
  with portfolio as (
    select p.empresa_id,
      count(*)::int total,
      count(*) filter(where upper(btrim(coalesce(p.status_interno,''))) not in ('ENCERRADO','FINALIZADO','ARQUIVADO') and upper(btrim(coalesce(p.status,''))) not in ('ENCERRADO','FINALIZADO','ARQUIVADO') and upper(btrim(coalesce(p.dados->>'situacao',''))) not in ('ENCERRADO','FINALIZADO','ARQUIVADO'))::int active,
      count(*) filter(where p.proximo_retorno<=p_day and
         upper(btrim(coalesce(p.status_interno,''))) not in ('ENCERRADO','FINALIZADO','ARQUIVADO') and upper(btrim(coalesce(p.status,''))) not in ('ENCERRADO','FINALIZADO','ARQUIVADO') and upper(btrim(coalesce(p.dados->>'situacao',''))) not in ('ENCERRADO','FINALIZADO','ARQUIVADO'))::int overdue,
      count(*) filter(where (p.tem_atualizacao_pos_retorno or p.djen_nova_comunicacao) and
         upper(btrim(coalesce(p.status_interno,''))) not in ('ENCERRADO','FINALIZADO','ARQUIVADO') and upper(btrim(coalesce(p.status,''))) not in ('ENCERRADO','FINALIZADO','ARQUIVADO') and upper(btrim(coalesce(p.dados->>'situacao',''))) not in ('ENCERRADO','FINALIZADO','ARQUIVADO'))::int alerts,
      count(*) filter(where upper(btrim(coalesce(p.status_interno,''))) not in ('ENCERRADO','FINALIZADO','ARQUIVADO') and upper(btrim(coalesce(p.status,''))) not in ('ENCERRADO','FINALIZADO','ARQUIVADO') and upper(btrim(coalesce(p.dados->>'situacao',''))) not in ('ENCERRADO','FINALIZADO','ARQUIVADO') and
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

-- Recupera revisões com fonte parcialmente indisponível, mesmo que DJEN tenha respondido.
create or replace function public.hermes_claim_due_review(p_today date)
returns table(empresa_id uuid, processo_id bigint, due_on date)
language sql set search_path=public
as $body$
 with candidate as (
  select p.id,p.empresa_id,p.proximo_retorno
  from public.processos p
  left join public.hermes_return_reviews r
   on r.empresa_id=p.empresa_id and r.processo_id=p.id and r.due_on=p.proximo_retorno
  where p.empresa_id is not null and p.proximo_retorno<=p_today
   and upper(btrim(coalesce(p.status_interno,''))) not in ('ENCERRADO','FINALIZADO','ARQUIVADO')
   and upper(btrim(coalesce(p.status,''))) not in ('ENCERRADO','FINALIZADO','ARQUIVADO')
   and upper(btrim(coalesce(p.dados->>'situacao',''))) not in ('ENCERRADO','FINALIZADO','ARQUIVADO')
   and (r.id is null
    or (r.state='unavailable' and r.attempted_at<now()-interval '4 hours')
    or (r.state='ready' and (r.djen_ok is not true or r.datajud_ok is not true)
       and r.attempted_at<now()-interval '6 hours')
    or (r.state='scanning' and r.attempted_at<now()-interval '15 minutes'))
  order by (case when p.proximo_retorno=p_today then 0 else 1 end),
           p.proximo_retorno asc,p.id asc limit 1
 ), claimed as (
  insert into public.hermes_return_reviews(empresa_id,processo_id,due_on,state,attempted_at)
  select empresa_id,id,proximo_retorno,'scanning',now() from candidate
  on conflict on constraint hermes_return_reviews_scope_due_unique
  do update set state='scanning',attempted_at=now()
  where (hermes_return_reviews.state='unavailable' and hermes_return_reviews.attempted_at<now()-interval '4 hours')
   or (hermes_return_reviews.state='ready'
      and (hermes_return_reviews.djen_ok is not true or hermes_return_reviews.datajud_ok is not true)
      and hermes_return_reviews.attempted_at<now()-interval '6 hours')
   or (hermes_return_reviews.state='scanning' and hermes_return_reviews.attempted_at<now()-interval '15 minutes')
  returning hermes_return_reviews.empresa_id,hermes_return_reviews.processo_id,hermes_return_reviews.due_on
 )
 select claimed.empresa_id,claimed.processo_id,claimed.due_on from claimed;
$body$;

-- Swarm Rebuild: ciclo real e auditável, baseado em métricas e feedback.
-- Nunca modifica arquivos, modelos, dados de atendimento ou conteúdo judicial.
create table if not exists public.hermes_rebuild_runs(
 id bigint generated by default as identity primary key,
 empresa_id uuid not null,
 day date not null,
 state text not null default 'audited' check(state in('audited','no_changes')),
 input_metrics jsonb not null default '{}'::jsonb,
 recommendations jsonb not null default '[]'::jsonb,
 findings_count integer not null default 0,
 evidence_count integer not null default 0,
 recorded_at timestamptz not null default now(),
 unique(empresa_id,day)
);
create index if not exists hermes_rebuild_recent on public.hermes_rebuild_runs(empresa_id,recorded_at desc);
alter table public.hermes_rebuild_runs enable row level security;
revoke all on public.hermes_rebuild_runs from public,anon,authenticated;
grant select,insert,update on public.hermes_rebuild_runs to service_role;

create or replace function public.hermes_rebuild_from_evidence(p_day date)
returns integer language plpgsql security invoker set search_path=public
as $body$
declare v_count integer:=0;
begin
 -- Etapa 1: coleta métricas reais e audita lacunas (idempotente).
 perform public.hermes_refresh_office_daily(p_day);
 perform public.hermes_audit_portfolio_gaps(p_day);
 -- Etapa 2: produz decisões determinísticas e verificáveis, nunca código não avaliado.
 with measured as (
  select d.empresa_id,d.day,d.metrics,
   (select count(*)::int from public.hermes_return_reviews r
    where r.empresa_id=d.empresa_id
     and r.attempted_at>now()-interval '30 days'
     and r.state='ready' and (r.djen_ok or r.datajud_ok)) as evidence,
   (select count(*)::int from public.hermes_office_events e
    where e.empresa_id=d.empresa_id
     and e.kind in('judicial_scan','portfolio_audit')
     and e.recorded_at>now()-interval '30 days') as findings
  from public.hermes_office_daily d where d.day=p_day
 ), suggestions as (
  select m.*,
   jsonb_build_array(
     jsonb_build_object('sector','processos','action',
       case when coalesce((m.metrics->>'unavailableReviews')::int,0)>0 then
        'Reconsultar revisões com DJEN/DataJud incompletos após o intervalo seguro.'
       else 'Continuar consultas periódicas dos retornos programados.' end,
       'evidence',coalesce((m.metrics->>'unavailableReviews')::int,0),'automated',true,
       'status','retry_policy_active'),
     jsonb_build_object('sector','operacao','action',
       case when coalesce((m.metrics->>'overdue')::int,0)>0 then
        'Priorizar retornos vencidos ainda ativos, sem incluir encerrados.'
       else 'Sem retornos ativos vencidos; manter monitoramento.' end,
       'evidence',coalesce((m.metrics->>'overdue')::int,0),'automated',true,
       'status','priority_policy_active'),
     jsonb_build_object('sector','agentes','action',
       case when coalesce((m.metrics->>'staleSources')::int,0)>0 then
        'Propor melhoria do scanner para fonte judicial desatualizada, sujeita a testes.'
       else 'Manter a política de verificação das fontes.' end,
       'evidence',coalesce((m.metrics->>'staleSources')::int,0),'automated',false,
       'status','awaits_code_review')
   ) as recs
  from measured m
 ), changed as (
  insert into public.hermes_rebuild_runs(empresa_id,day,state,input_metrics,recommendations,findings_count,evidence_count)
  select s.empresa_id,s.day,case when s.findings+s.evidence>0 then 'audited' else 'no_changes' end,
    s.metrics,s.recs,s.findings,s.evidence from suggestions s
  on conflict(empresa_id,day) do update set
    state=excluded.state,input_metrics=excluded.input_metrics,
    recommendations=excluded.recommendations,
    findings_count=excluded.findings_count,evidence_count=excluded.evidence_count,
    recorded_at=now()
  where hermes_rebuild_runs.input_metrics is distinct from excluded.input_metrics
    or hermes_rebuild_runs.evidence_count is distinct from excluded.evidence_count
    or hermes_rebuild_runs.findings_count is distinct from excluded.findings_count
  returning empresa_id,day,state,findings_count,evidence_count
 ), audited as (
  insert into public.hermes_office_events(empresa_id,sector,kind,status,title,detail)
  select c.empresa_id,'agentes','swarm_rebuild','completed',
   'Swarm Rebuild: auditoria operacional finalizada',
   c.evidence_count::text||' revisões confirmadas e '||c.findings_count::text||
   ' verificações analisadas; política de repetição priorizada. Não houve alteração automática do código.'
  from changed c returning 1
 )
 select count(*) into v_count from audited;
 return v_count;
end
$body$;
revoke all on function public.hermes_rebuild_from_evidence(date) from public,anon,authenticated;
grant execute on function public.hermes_rebuild_from_evidence(date) to service_role;

do $schedule$
begin
 if not exists (select 1 from cron.job where jobname='lexis-hermes-swarm-rebuild') then
   perform cron.schedule('lexis-hermes-swarm-rebuild','45 11,15,19,22 * * *',
    'select public.hermes_rebuild_from_evidence((now() at time zone ''America/Sao_Paulo'')::date);');
 end if;
end
$schedule$;
