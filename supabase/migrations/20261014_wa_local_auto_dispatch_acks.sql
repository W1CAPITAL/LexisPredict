-- Applied to Supabase on 2026-10-14: automatic WA device return dispatch.
ALTER TABLE public.wa_daily_return_sends ADD COLUMN IF NOT EXISTS wa_job_id uuid;
ALTER TABLE public.wa_daily_return_sends ADD COLUMN IF NOT EXISTS prior_return date;
CREATE UNIQUE INDEX IF NOT EXISTS wa_daily_return_sends_wa_job_uq ON public.wa_daily_return_sends(wa_job_id) WHERE wa_job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS wa_daily_return_sends_status_idx ON public.wa_daily_return_sends(empresa_id,local_day,status);

CREATE OR REPLACE FUNCTION public.wa_automatic_return_ack()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s public.wa_daily_return_sends%rowtype; cfg record; changed bigint;
begin
  if new.status is not distinct from old.status then return new; end if;
  if new.status in ('accepted','delivered','read') then
    update public.wa_daily_return_sends set status='sent',
      sent_at=coalesce(sent_at,now()),last_error=null
    where empresa_id=new.empresa_id and wa_job_id=new.id and status='reserved'
    returning * into s;
    if found then
      select interval_days into cfg from public.wa_daily_return_settings
        where empresa_id=s.empresa_id;
      update public.processos
        set ultimo_retorno=s.local_day,
          proximo_retorno=s.local_day + least(30,greatest(1,coalesce(cfg.interval_days,1))),
          updated_at=now(),
          dados=coalesce(dados,'{}'::jsonb)||jsonb_build_object(
            'ultimoRetorno',s.local_day,
            'ultimo_retorno',s.local_day,
            'proximoRetorno',s.local_day+least(30,greatest(1,coalesce(cfg.interval_days,1))),
            'wa_ultimo_retorno',jsonb_build_object('data',s.local_day,'envio_id',s.id))
      where empresa_id=s.empresa_id and id=s.processo_id
        and ultimo_retorno is not distinct from s.prior_return
        and (s.event_at at time zone 'America/Sao_Paulo')::date > coalesce(ultimo_retorno,date '2000-01-01')
      returning id into changed;
      update public.wa_daily_return_checks
        set result=case when changed is not null then 'sent' else 'sent_dates_review' end,
          checked_at=now()
        where empresa_id=s.empresa_id and processo_id=s.processo_id
          and local_day=s.local_day and mode='due';
    end if;
  elsif new.status in ('failed','uncertain') then
    update public.wa_daily_return_sends
      set status=case when new.status='failed' then 'rejected' else 'uncertain' end,
        last_error=coalesce(new.last_error,'WhatsApp did not confirm the send')
      where empresa_id=new.empresa_id and wa_job_id=new.id and status='reserved'
      returning * into s;
    if found then
      update public.wa_daily_return_checks
      set result=case when new.status='failed' then 'send_rejected' else 'send_uncertain' end,
        checked_at=now()
      where empresa_id=s.empresa_id and processo_id=s.processo_id
        and local_day=s.local_day and mode='due';
    end if;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.wa_local_attach_return(p_empresa uuid, p_send uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s public.wa_daily_return_sends%rowtype; job uuid; owner_id uuid;
begin
  select * into s from public.wa_daily_return_sends
  where empresa_id=p_empresa and id=p_send for update;
  if not found then raise exception 'Notice not found'; end if;
  if s.wa_job_id is not null then return s.wa_job_id; end if;
  if s.status<>'reserved' then raise exception 'Notice is not reserved'; end if;
  if not exists(select 1 from public.wa_local_bridges
    where empresa_id=p_empresa and state='ready'
      and last_seen > now()-interval '45 seconds')
  then raise exception 'Device offline'; end if;
  select owner_auth_id into owner_id from public.wa_daily_return_settings
    where empresa_id=p_empresa and enabled=true and consent_attested=true;
  if owner_id is null then raise exception 'Automation not authorized'; end if;
  update public.wa_daily_return_sends
    set prior_return=(select ultimo_retorno from public.processos
      where id=s.processo_id and empresa_id=p_empresa)
    where id=s.id and empresa_id=p_empresa;
  insert into public.wa_local_jobs(empresa_id,created_by,to_phone,body,status)
    values(p_empresa,owner_id,s.phone,s.message,'pending') returning id into job;
  update public.wa_daily_return_sends set wa_job_id=job
    where id=s.id and empresa_id=p_empresa;
  return job;
end $function$
;

REVOKE ALL ON FUNCTION public.wa_local_attach_return(uuid,uuid) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wa_local_attach_return(uuid,uuid) TO service_role;
DROP TRIGGER IF EXISTS trg_wa_automatic_return_ack ON public.wa_local_jobs;
CREATE TRIGGER trg_wa_automatic_return_ack AFTER UPDATE OF status ON public.wa_local_jobs FOR EACH ROW EXECUTE FUNCTION public.wa_automatic_return_ack();
