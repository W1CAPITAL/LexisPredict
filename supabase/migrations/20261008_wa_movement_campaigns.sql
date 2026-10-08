-- WA.Auto: fila de avisos da última movimentação, separada por empresa/sessão.
-- Nenhum disparo é realizado por esta migração.
create table if not exists public.wa_movement_campaigns (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  owner_auth_id uuid not null,
  status text not null default 'running'
    check(status in ('running','paused','completed','cancelled')),
  consent_attested boolean not null default false,
  total integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  uncertain_count integer not null default 0,
  next_send_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_wa_mov_camp_ready
  on public.wa_movement_campaigns (status, next_send_at);
create index if not exists idx_wa_mov_camp_company
  on public.wa_movement_campaigns (empresa_id, created_at desc);
create unique index if not exists idx_wa_mov_one_running_company
  on public.wa_movement_campaigns (empresa_id) where status = 'running';

create table if not exists public.wa_movement_dispatches (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.wa_movement_campaigns(id) on delete cascade,
  empresa_id uuid not null,
  processo_id bigint not null,
  protocolo text not null,
  phone text not null,
  client_name text not null,
  source text not null check(source in ('DataJud','DJEN')),
  event_at timestamptz not null,
  event_hash text not null,
  message text not null check(char_length(message) between 1 and 8000),
  status text not null default 'pending'
    check(status in ('pending','processing','sent','failed','uncertain','cancelled')),
  last_error text,
  claimed_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique(empresa_id, processo_id, event_hash)
);
create index if not exists idx_wa_mov_dispatch_ready
  on public.wa_movement_dispatches (campaign_id, status, id);
create index if not exists idx_wa_mov_dispatch_company_date
  on public.wa_movement_dispatches (empresa_id, sent_at desc) where status = 'sent';

alter table public.wa_movement_campaigns enable row level security;
alter table public.wa_movement_dispatches enable row level security;
-- Service role only. User access is exclusively through authorized server actions.
revoke all on public.wa_movement_campaigns from anon, authenticated;
revoke all on public.wa_movement_dispatches from anon, authenticated;
grant all on public.wa_movement_campaigns to service_role;
grant all on public.wa_movement_dispatches to service_role;

-- Atomic claim, with per-company pacing. A timed-out processing entry is
-- UNCERTAIN, never silently retried (WhatsApp may have received it).
create or replace function public.wa_claim_movement(p_campaign uuid default null)
returns setof public.wa_movement_dispatches
language plpgsql security definer set search_path = public as $$
declare c public.wa_movement_campaigns%rowtype;
        e public.wa_movement_dispatches%rowtype;
        daily_count integer;
begin
  update public.wa_movement_dispatches
     set status='uncertain', last_error='Resultado desconhecido após interrupção; confira o WhatsApp antes de reenviar.'
   where status='processing' and claimed_at < now()-interval '5 minutes';
  update public.wa_movement_campaigns c0
     set status='paused',updated_at=now()
   where status='running' and exists(
     select 1 from public.wa_movement_dispatches d
      where d.campaign_id=c0.id and d.status='uncertain'
   );

  select * into c from public.wa_movement_campaigns
   where status='running'
     and next_send_at <= now()
     and (p_campaign is null or id=p_campaign)
   order by next_send_at,created_at
   for update skip locked limit 1;
  if not found then return; end if;

  select count(*) into daily_count from public.wa_movement_dispatches
   where empresa_id=c.empresa_id and status='sent'
     and (sent_at at time zone 'America/Sao_Paulo')::date =
         (now() at time zone 'America/Sao_Paulo')::date;
  if daily_count >= 120 then
    update public.wa_movement_campaigns set next_send_at =
      (date_trunc('day',now() at time zone 'America/Sao_Paulo') + interval '1 day 8 hours')
         at time zone 'America/Sao_Paulo'
      where id=c.id;
    return;
  end if;

  select * into e from public.wa_movement_dispatches
   where campaign_id=c.id and status='pending'
   order by created_at,id for update skip locked limit 1;
  if not found then
    if not exists(select 1 from public.wa_movement_dispatches
                  where campaign_id=c.id and status='processing') then
      update public.wa_movement_campaigns
        set status='completed',updated_at=now() where id=c.id;
    end if;
    return;
  end if;

  update public.wa_movement_dispatches
     set status='processing',claimed_at=now()
   where id=e.id;
  update public.wa_movement_campaigns
    set next_send_at=now()+interval '45 seconds',updated_at=now()
    where id=c.id;
  e.status='processing';
  e.claimed_at=now();
  return next e;
end $$;

create or replace function public.wa_finish_movement(
  p_id uuid, p_status text, p_error text default null
) returns void language plpgsql security definer set search_path=public as $$
declare c_id uuid;
begin
  if p_status not in ('sent','failed','uncertain') then
     raise exception 'Status inválido';
  end if;
  update public.wa_movement_dispatches
    set status=p_status, last_error=left(p_error,300),
        sent_at=case when p_status='sent' then now() else null end
    where id=p_id and status='processing'
    returning campaign_id into c_id;
  if c_id is null then return; end if;
  update public.wa_movement_campaigns
    set sent_count=sent_count+(p_status='sent')::int,
        failed_count=failed_count+(p_status='failed')::int,
        uncertain_count=uncertain_count+(p_status='uncertain')::int,
        status=case when p_status='uncertain' then 'paused' else status end,
        updated_at=now()
    where id=c_id;
  if not exists(select 1 from public.wa_movement_dispatches
                where campaign_id=c_id and status in ('pending','processing')) then
    update public.wa_movement_campaigns
      set status=case when status='running' then 'completed' else status end,
          updated_at=now()
      where id=c_id;
  end if;
end $$;

revoke all on function public.wa_claim_movement(uuid) from public,anon,authenticated;
revoke all on function public.wa_finish_movement(uuid,text,text) from public,anon,authenticated;
grant execute on function public.wa_claim_movement(uuid) to service_role;
grant execute on function public.wa_finish_movement(uuid,text,text) to service_role;
