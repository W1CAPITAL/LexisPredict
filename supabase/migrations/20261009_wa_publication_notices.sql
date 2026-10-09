-- New publication notices use existing atomic WA.Auto queue and per-tenant RLS.
-- No campaigns are started by this schema change.
alter table public.wa_movement_campaigns
  add column if not exists campaign_kind text not null default 'movement';
do $$ begin
  if not exists(select 1 from pg_constraint where conname='wa_movement_campaigns_kind_valid') then
    alter table public.wa_movement_campaigns add constraint wa_movement_campaigns_kind_valid
      check(campaign_kind in ('movement','publication'));
  end if;
end $$;
create index if not exists idx_wa_pub_daily_contact
  on public.wa_movement_dispatches(empresa_id,phone,sent_at desc) where status='sent';

-- Durable quota + one notice per phone/24h. No jitter or text randomization
-- to circumvent spam detection. Business messaging rules still apply.
create or replace function public.wa_claim_movement(p_campaign uuid default null)
returns setof public.wa_movement_dispatches
language plpgsql security definer set search_path = public as $$
declare c public.wa_movement_campaigns%rowtype;
        e public.wa_movement_dispatches%rowtype;
        daily_count integer;
        publication_count integer;
        next_work timestamptz;
        min_gap interval;
begin
  update public.wa_movement_dispatches
     set status='uncertain',
         last_error='Resultado desconhecido após interrupção; confira a conversa antes de reenviar.'
   where status='processing' and claimed_at < now()-interval '5 minutes';
  update public.wa_movement_campaigns c0
     set status='paused',updated_at=now()
   where status='running' and exists(
     select 1 from public.wa_movement_dispatches d
      where d.campaign_id=c0.id and d.status='uncertain'
   );
  select * into c from public.wa_movement_campaigns
   where status='running' and next_send_at<=now()
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
      (date_trunc('day',now() at time zone 'America/Sao_Paulo') + interval '1 day 9 hours')
      at time zone 'America/Sao_Paulo'
      where id=c.id;
    return;
  end if;
  if c.campaign_kind='publication' then
    select count(*) into publication_count
      from public.wa_movement_dispatches d
      join public.wa_movement_campaigns camp on camp.id=d.campaign_id
      where d.empresa_id=c.empresa_id and d.status='sent'
        and camp.campaign_kind='publication'
        and (d.sent_at at time zone 'America/Sao_Paulo')::date =
            (now() at time zone 'America/Sao_Paulo')::date;
    if publication_count>=25 then
      update public.wa_movement_campaigns set next_send_at =
        (date_trunc('day',now() at time zone 'America/Sao_Paulo') + interval '1 day 9 hours')
           at time zone 'America/Sao_Paulo'
      where id=c.id;
      return;
    end if;
    -- Send business notices only during staffed weekday hours.
    if extract(isodow from now() at time zone 'America/Sao_Paulo')>5 or
       (now() at time zone 'America/Sao_Paulo')::time < time '09:00' or
       (now() at time zone 'America/Sao_Paulo')::time >= time '18:00' then
      update public.wa_movement_campaigns set next_send_at=now()+interval '1 hour'
      where id=c.id;
      return;
    end if;
  end if;
  select * into e from public.wa_movement_dispatches
   where campaign_id=c.id and status='pending'
     and (c.campaign_kind<>'publication' or not exists (
       select 1 from public.wa_movement_dispatches previous
        where previous.empresa_id=c.empresa_id
          and previous.phone=wa_movement_dispatches.phone
          and previous.status='sent'
          and previous.sent_at>now()-interval '24 hours'
     ))
   order by created_at,id for update skip locked limit 1;
  if not found then
    if exists(select 1 from public.wa_movement_dispatches
              where campaign_id=c.id and status='pending') then
      -- Remaining recipients are waiting for their 24h window; do not
      -- incorrectly complete the campaign.
      update public.wa_movement_campaigns set next_send_at=now()+interval '1 hour' where id=c.id;
    elsif not exists(select 1 from public.wa_movement_dispatches
                  where campaign_id=c.id and status='processing') then
      update public.wa_movement_campaigns
        set status='completed',updated_at=now() where id=c.id;
    end if;
    return;
  end if;
  update public.wa_movement_dispatches
    set status='processing',claimed_at=now() where id=e.id;
  min_gap=case when c.campaign_kind='publication'
    then interval '3 minutes' else interval '45 seconds' end;
  update public.wa_movement_campaigns
    set next_send_at=now()+min_gap,updated_at=now() where id=c.id;
  e.status='processing';e.claimed_at=now();
  return next e;
end $$;
revoke all on function public.wa_claim_movement(uuid) from public,anon,authenticated;
grant execute on function public.wa_claim_movement(uuid) to service_role;
