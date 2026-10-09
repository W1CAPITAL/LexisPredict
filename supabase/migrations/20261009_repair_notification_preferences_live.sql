-- Repair a legacy notification schema without dropping cases or existing alerts.
-- The notification UI writes from authenticated server actions and expects
-- public.notification_preferences plus text priorities.
create table if not exists public.notification_preferences (
 user_id uuid primary key,
 empresa_id uuid not null,
 in_app_enabled boolean not null default true,
 browser_enabled boolean not null default false,
 prazos boolean not null default true,
 djen boolean not null default true,
 datajud boolean not null default true,
 tarefas boolean not null default true,
 chat boolean not null default true,
 sistema boolean not null default true,
 sound_enabled boolean not null default false,
 quiet_hours_enabled boolean not null default false,
 quiet_hours_start time,
 quiet_hours_end time,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists notification_preferences_empresa_idx
  on public.notification_preferences(empresa_id,user_id);

alter table public.notificacoes
 add column if not exists recipient_user_id uuid,
 add column if not exists link text,
 add column if not exists dedupe_key text,
 add column if not exists source text,
 add column if not exists meta jsonb not null default '{}'::jsonb,
 add column if not exists read_at timestamptz,
 add column if not exists updated_at timestamptz not null default now();

-- Legacy records had integer prioridade; incoming notifications use text levels.
do $$
declare priority_type text;
begin
 select data_type into priority_type from information_schema.columns
  where table_schema='public' and table_name='notificacoes' and column_name='prioridade';
 if priority_type <> 'text' then
   alter table public.notificacoes alter column prioridade drop default;
   alter table public.notificacoes alter column prioridade type text
    using case
       when prioridade::text='1' then 'critica'
       when prioridade::text='2' then 'alta'
       when prioridade::text='3' then 'normal'
       else coalesce(prioridade::text,'normal')
    end;
 end if;
end $$;
alter table public.notificacoes alter column prioridade set default 'normal';

create unique index if not exists notificacoes_dedupe_user_idx
 on public.notificacoes(empresa_id,recipient_user_id,dedupe_key)
 where dedupe_key is not null;
create index if not exists notificacoes_user_unread_idx
 on public.notificacoes(recipient_user_id,lida,created_at desc);

alter table public.notification_preferences enable row level security;
alter table public.notificacoes enable row level security;
drop policy if exists notification_preferences_select_own on public.notification_preferences;
create policy notification_preferences_select_own on public.notification_preferences
  for select to authenticated using (user_id=(select auth.uid()) and empresa_id=(select public.current_empresa_id()));
drop policy if exists notification_preferences_insert_own on public.notification_preferences;
create policy notification_preferences_insert_own on public.notification_preferences
  for insert to authenticated with check (user_id=(select auth.uid()) and empresa_id=(select public.current_empresa_id()));
drop policy if exists notification_preferences_update_own on public.notification_preferences;
create policy notification_preferences_update_own on public.notification_preferences
  for update to authenticated using (user_id=(select auth.uid()) and empresa_id=(select public.current_empresa_id()))
  with check (user_id=(select auth.uid()) and empresa_id=(select public.current_empresa_id()));

drop policy if exists notificacoes_select_own on public.notificacoes;
create policy notificacoes_select_own on public.notificacoes
 for select to authenticated using (empresa_id=(select public.current_empresa_id()) and recipient_user_id=(select auth.uid()));
drop policy if exists notificacoes_update_own on public.notificacoes;
create policy notificacoes_update_own on public.notificacoes
 for update to authenticated using (empresa_id=(select public.current_empresa_id()) and recipient_user_id=(select auth.uid()))
 with check (empresa_id=(select public.current_empresa_id()) and recipient_user_id=(select auth.uid()));
drop policy if exists notificacoes_delete_own on public.notificacoes;
create policy notificacoes_delete_own on public.notificacoes
 for delete to authenticated using (empresa_id=(select public.current_empresa_id()) and recipient_user_id=(select auth.uid()));

grant select,insert,update on public.notification_preferences to authenticated;
grant select,update,delete on public.notificacoes to authenticated;
grant all on public.notification_preferences to service_role;
grant all on public.notificacoes to service_role;

-- Restrict tenant leaks on realtime user events as well.
do $$
begin
 if not exists(select 1 from pg_publication_tables
   where pubname='supabase_realtime' and schemaname='public' and tablename='notificacoes')
 then alter publication supabase_realtime add table public.notificacoes; end if;
end $$;
