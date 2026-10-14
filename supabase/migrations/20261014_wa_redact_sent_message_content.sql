create or replace function public.wa_redact_completed_outbound()
returns trigger language plpgsql security definer set search_path to ''
as $$
begin
 if new.status is distinct from old.status
   and new.status in ('accepted','delivered','read','failed','uncertain') then
   update public.wa_local_jobs set body='[Conteúdo descartado após processamento]'
     where id=new.id and empresa_id=new.empresa_id and body<>'[Conteúdo descartado após processamento]';
   update public.wa_daily_return_sends set message='[Conteúdo descartado após processamento]'
     where wa_job_id=new.id and empresa_id=new.empresa_id;
   update public.wa_movement_dispatches set message='[Conteúdo descartado após processamento]'
     where wa_job_id=new.id and empresa_id=new.empresa_id;
 end if;
 return new;
end $$;
drop trigger if exists trg_zz_wa_redact_completed_outbound on public.wa_local_jobs;
create trigger trg_zz_wa_redact_completed_outbound
after update of status on public.wa_local_jobs
for each row execute function public.wa_redact_completed_outbound();