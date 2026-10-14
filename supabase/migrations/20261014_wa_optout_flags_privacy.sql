create table if not exists public.wa_contact_optouts (
 empresa_id uuid not null,
 phone text not null check (phone ~ '^55[0-9]{10,11}$'),
 opted_out_at timestamptz not null default now(),
 primary key(empresa_id,phone)
);
alter table public.wa_contact_optouts enable row level security;
revoke all on public.wa_contact_optouts from public,anon,authenticated;
grant select,insert,update,delete on public.wa_contact_optouts to service_role;
insert into public.wa_contact_optouts (empresa_id,phone,opted_out_at)
select empresa_id,
 case when length(regexp_replace(coalesce(contact_number,phone,''),'[^0-9]','','g')) in (10,11)
      then '55'||regexp_replace(coalesce(contact_number,phone,''),'[^0-9]','','g')
      else regexp_replace(coalesce(contact_number,phone,''),'[^0-9]','','g') end,
 max(created_at)
from public.whatsapp_messages
where from_me=false
 and btrim(coalesce(message_text,body,'')) ~* '^(SAIR|STOP|PARE|CANCELAR MENSAGENS|NÃO ME ENVIE MENSAGENS|NAO ME ENVIE MENSAGENS)[[:space:].!?]*$'
 and coalesce(contact_number,phone,'') <> ''
group by empresa_id,2
on conflict (empresa_id,phone) do update
set opted_out_at=greatest(public.wa_contact_optouts.opted_out_at,excluded.opted_out_at);