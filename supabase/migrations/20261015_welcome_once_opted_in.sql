
create or replace function public.lexis_queue_welcome_one()
returns uuid language plpgsql security definer set search_path=''
as $fn$
declare r record; new_job uuid;
begin
 select p.auth_user_id,p.empresa_id,p.display_name,p.phone
 into r from public.lexis_user_experience p
 join public.wa_local_bridges b on b.empresa_id=p.empresa_id
 where p.welcome_status='waiting' and p.welcome_opt_in=true
 and p.terms_accepted_at is not null and p.phone ~ '^55[1-9][0-9]{9,10}$'
 and b.state='ready' and b.last_seen>now()-interval '45 seconds'
 order by p.created_at
 for update of p skip locked limit 1;
 if not found then return null; end if;
 if exists(select 1 from public.wa_contact_optouts o
           where o.empresa_id=r.empresa_id and o.phone=r.phone) then
  update public.lexis_user_experience set welcome_status='not_sent',updated_at=now()
   where auth_user_id=r.auth_user_id;
  return null;
 end if;
 if exists(select 1 from public.wa_local_jobs j where j.empresa_id=r.empresa_id
  and j.created_at>now()-interval '45 seconds') then return null; end if;
 if (select count(*) from public.wa_local_jobs j
       where j.empresa_id=r.empresa_id
         and j.created_at>(now() at time zone 'America/Sao_Paulo')::date
           at time zone 'America/Sao_Paulo')>=120 then return null; end if;
 insert into public.wa_local_jobs(empresa_id,created_by,to_phone,body,status)
 values (r.empresa_id,r.auth_user_id,r.phone,
   format('Olá, %s! 👋 Boas-vindas ao LexisPredict! Seu ambiente foi personalizado e suas preferências estão salvas. Este número recebe apenas esta mensagem inicial por sua escolha no cadastro. Para ajuda, acesse o suporte dentro do aplicativo.',split_part(r.display_name,' ',1)),
   'pending')
 returning id into new_job;
 update public.lexis_user_experience
 set welcome_job_id=new_job,welcome_status='queued',updated_at=now()
 where auth_user_id=r.auth_user_id;
 return new_job;
end
$fn$;
revoke all on function public.lexis_queue_welcome_one() from public,anon,authenticated;
grant execute on function public.lexis_queue_welcome_one() to service_role;

create or replace function public.lexis_welcome_delivery_ack()
returns trigger language plpgsql security definer set search_path=''
as $fn$
begin
 if new.status is distinct from old.status then
  if new.status in ('delivered','read') then
   update public.lexis_user_experience set welcome_status='sent',updated_at=now()
   where welcome_job_id=new.id and welcome_status='queued';
  elsif new.status in ('failed','rejected') then
   update public.lexis_user_experience set welcome_status='failed',updated_at=now()
   where welcome_job_id=new.id and welcome_status='queued';
  end if;
 end if;
 return new;
end
$fn$;
drop trigger if exists tr_lexis_welcome_delivery_ack on public.wa_local_jobs;
create trigger tr_lexis_welcome_delivery_ack after update of status on public.wa_local_jobs
for each row execute function public.lexis_welcome_delivery_ack();
