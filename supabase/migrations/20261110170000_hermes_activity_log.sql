-- Auditoria operacional Hermes: somente eventos confirmados pelo banco.
-- Não registra conteúdo de peças, CPFs, nomes ou prompt externo.
create table if not exists public.hermes_office_events (
  id bigint generated always as identity primary key,
  empresa_id uuid not null,
  sector text not null,
  kind text not null,
  status text not null check(status in ('working','completed','warning')),
  title text not null,
  detail text,
  processo_id bigint,
  recorded_at timestamptz not null default now()
);
create index if not exists hermes_office_events_company_recent_idx
  on public.hermes_office_events(empresa_id,recorded_at desc,id desc);
alter table public.hermes_office_events enable row level security;
revoke all on public.hermes_office_events from public,anon,authenticated;
grant select,insert on public.hermes_office_events to service_role;
alter table public.hermes_office_daily
  add column if not exists meeting_error_code text,
  add column if not exists meeting_attempts integer not null default 0;

-- Até três tentativas por dia/empresa. A falha de IA anterior pode ser retomada,
-- com intervalo mínimo de 2 minutos; jamais repete reuniões concluídas.
create or replace function public.hermes_claim_office_meeting(p_empresa uuid,p_day date)
returns jsonb language plpgsql security invoker set search_path=public
as $body$
declare v_metrics jsonb;
begin
 update public.hermes_office_daily d
 set meeting_status='running',meeting_claimed_at=now(),
     meeting_attempts=d.meeting_attempts+1,meeting_error_code=null
 where d.empresa_id=p_empresa and d.day=p_day
   and d.meeting_attempts<3
   and (d.meeting_status='pending'
     or (d.meeting_status = 'unavailable'
         and d.meeting_claimed_at < now()-interval '2 minutes')
     or (d.meeting_status='running'
         and d.meeting_claimed_at < now()-interval '5 minutes'))
 returning d.metrics into v_metrics;
 return v_metrics;
end
$body$;
revoke all on function public.hermes_claim_office_meeting(uuid,date) from public,anon,authenticated;
grant execute on function public.hermes_claim_office_meeting(uuid,date) to service_role;

create or replace function public.hermes_record_return_event()
returns trigger language plpgsql set search_path=public
as $body$
declare v_title text;v_detail text;v_status text;v_sector text;
begin
 if TG_OP='UPDATE' and new.state is not distinct from old.state
   and new.checked_at is not distinct from old.checked_at then return new; end if;
 if new.state='scanning' then
    v_title:='Consulta judicial iniciada';v_status:='working';v_sector:='processos';
    v_detail:='Processo cadastrado para conferir DJEN e DataJud; resultado ainda não confirmado.';
 elsif new.state='ready' then
    v_title:='Consulta judicial registrada';v_status:='completed';v_sector:='processos';
    v_detail:='DJEN: '||(case when new.djen_ok then 'consultado' else 'sem confirmação' end)||
      ' · DataJud: '||(case when new.datajud_ok then 'consultado' else 'sem confirmação' end)||
      ' · prioridade: '||coalesce(new.priority_label,'não classificada')||'.';
 elsif new.state='unavailable' then
    v_title:='Consulta requer nova tentativa';v_status:='warning';v_sector:='processos';
    v_detail:='Uma ou mais fontes oficiais não responderam. Não concluir ausência de movimentação.';
 else return new;
 end if;
 insert into public.hermes_office_events(empresa_id,sector,kind,status,title,detail,processo_id,recorded_at)
 values(new.empresa_id,v_sector,'judicial_scan',v_status,v_title,v_detail,new.processo_id,
        coalesce(new.checked_at,new.attempted_at,now()));
 if new.state='ready' and coalesce(new.message_draft,'')<>'' then
   insert into public.hermes_office_events(empresa_id,sector,kind,status,title,detail,processo_id,recorded_at)
   values(new.empresa_id,'comunicacoes','draft','completed','Rascunho de contato preparado',
     'Mensagem armazenada para conferência humana, sem envio automático.',new.processo_id,coalesce(new.checked_at,now()));
 end if;
 return new;
end
$body$;
drop trigger if exists hermes_return_event_audit on public.hermes_return_reviews;
create trigger hermes_return_event_audit after insert or update on public.hermes_return_reviews
 for each row execute function public.hermes_record_return_event();

create or replace function public.hermes_record_office_event()
returns trigger language plpgsql set search_path=public
as $body$
begin
 if TG_OP='INSERT' or new.metrics is distinct from old.metrics then
   insert into public.hermes_office_events(empresa_id,sector,kind,status,title,detail)
   values(new.empresa_id,'relatorios','snapshot','completed','Indicadores consolidados',
      'Resumo atualizado a partir do banco; confira os indicadores em /report.');
 end if;
 if (TG_OP='INSERT' and new.meeting_status<>'pending') or
    (TG_OP='UPDATE' and new.meeting_status is distinct from old.meeting_status) then
    insert into public.hermes_office_events(empresa_id,sector,kind,status,title,detail)
    values(new.empresa_id,'gestao','meeting',
      (case when new.meeting_status='running' then 'working'
         when new.meeting_status='ready' then 'completed' else 'warning' end),
      (case when new.meeting_status='running' then 'Reunião de supervisão iniciada'
         when new.meeting_status='ready' then 'Reunião de supervisão concluída'
         when new.meeting_status='unavailable' then 'Reunião aguardando resposta da IA'
         else 'Reunião atualizada' end),
      (case when new.meeting_status='ready' then
         'Ata registrada pelo motor '||coalesce(new.meeting_engine,'não identificado')||'.'
         when new.meeting_status='unavailable' then
         'Modelo indisponível ('||coalesce(new.meeting_error_code,'motivo não classificado')||'). Ata provisória por regras.'
         else 'Gerência reunindo números agregados; nenhum contato foi enviado.' end));
 end if;
 return new;
end
$body$;
drop trigger if exists hermes_office_event_audit on public.hermes_office_daily;
create trigger hermes_office_event_audit after insert or update on public.hermes_office_daily
 for each row execute function public.hermes_record_office_event();

-- Reconstrução mínima dos eventos que o banco já confirma, sem inventar execução.
insert into public.hermes_office_events(empresa_id,sector,kind,status,title,detail,processo_id,recorded_at)
select r.empresa_id,'processos','judicial_scan',
       case when r.state='ready' then 'completed' else 'warning' end,
       case when r.state='ready' then 'Consulta judicial registrada' else 'Consulta indisponível' end,
       'DJEN: '||(case when r.djen_ok then 'consultado' else 'sem confirmação' end)||
       ' · DataJud: '||(case when r.datajud_ok then 'consultado' else 'sem confirmação' end),
       r.processo_id,coalesce(r.checked_at,r.attempted_at,now())
from public.hermes_return_reviews r
where r.state in('ready','unavailable');

insert into public.hermes_office_events(empresa_id,sector,kind,status,title,detail,recorded_at)
select d.empresa_id,'gestao','meeting',
       case when d.meeting_status='ready' then 'completed' else 'warning' end,
       case when d.meeting_status='ready' then 'Reunião de supervisão concluída' else 'Reunião com IA indisponível' end,
       'Histórico já persistido; '||coalesce(d.meeting_engine,'motor desconhecido')||'.',
       d.updated_at
from public.hermes_office_daily d where d.meeting_status in('ready','unavailable');

do $job$
begin
 if exists(select 1 from cron.job where jobname='lexis-hermes-office-events-retention') then
    perform cron.unschedule('lexis-hermes-office-events-retention');
 end if;
 perform cron.schedule('lexis-hermes-office-events-retention','50 6 * * *',
 'delete from public.hermes_office_events where recorded_at<now()-interval ''90 days'';');
end
$job$;
