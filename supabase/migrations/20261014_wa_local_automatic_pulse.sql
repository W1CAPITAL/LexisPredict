alter table public.wa_local_bridges add column if not exists auto_pulse_at timestamptz;
create or replace function public.wa_auto_pulse(p_empresa uuid)
returns boolean language plpgsql security definer set search_path to ''
as $$
declare n integer;
begin
  update public.wa_local_bridges set auto_pulse_at=now()
    where empresa_id=p_empresa and state='ready'
      and last_seen>now()-interval '45 seconds'
      and (auto_pulse_at is null or auto_pulse_at<now()-interval '65 seconds');
  get diagnostics n=row_count;
  return n>0;
end $$;
revoke all on function public.wa_auto_pulse(uuid) from public,anon,authenticated;
grant execute on function public.wa_auto_pulse(uuid) to service_role;