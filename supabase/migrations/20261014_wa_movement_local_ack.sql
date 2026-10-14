-- Existing linked WA.Auto device settles movement campaigns by real ACK.
-- Independent tenant-scoped job id; no Evolution, no browser polling.
alter table public.wa_movement_dispatches add column if not exists wa_job_id uuid;
create unique index if not exists wa_movement_dispatches_wa_job_uq
 on public.wa_movement_dispatches(wa_job_id) where wa_job_id is not null;
create index if not exists wa_movement_dispatches_active_idx
 on public.wa_movement_dispatches(empresa_id,campaign_id,status,created_at);
create or replace function public.wa_movement_local_ack()
returns trigger language plpgsql security definer set search_path to ''
as $$
declare dispatch_id uuid;
begin
 if new.status is not distinct from old.status then return new; end if;
 select d.id into dispatch_id from public.wa_movement_dispatches d
  where d.empresa_id=new.empresa_id and d.wa_job_id=new.id limit 1;
 if dispatch_id is null then return new; end if;
 if new.status in ('accepted','delivered','read') then
  perform public.wa_finish_movement(dispatch_id,'sent',null);
 elsif new.status='failed' then
  perform public.wa_finish_movement(dispatch_id,'failed',coalesce(new.last_error,'Linked WhatsApp device rejected send'));
 elsif new.status='uncertain' then
  perform public.wa_finish_movement(dispatch_id,'uncertain',coalesce(new.last_error,'Linked-device delivery unconfirmed'));
 end if;
 return new;
end $$;
drop trigger if exists trg_wa_movement_local_ack on public.wa_local_jobs;
create trigger trg_wa_movement_local_ack after update of status
 on public.wa_local_jobs for each row execute function public.wa_movement_local_ack();
