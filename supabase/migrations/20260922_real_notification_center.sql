-- Real notification center for LexisPredict.
-- Applied to Supabase project yzfnfoowbcwrwhhvnypc.

alter table public.notificacoes
  add column if not exists recipient_user_id uuid,
  add column if not exists tipo text not null default 'sistema',
  add column if not exists prioridade text not null default 'normal',
  add column if not exists source text,
  add column if not exists link text,
  add column if not exists dedupe_key text,
  add column if not exists processo_id bigint,
  add column if not exists meta jsonb not null default '{}'::jsonb,
  add column if not exists read_at timestamptz,
  add column if not exists expires_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

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

create unique index if not exists notificacoes_dedupe_user_idx
  on public.notificacoes (empresa_id, recipient_user_id, dedupe_key)
  where dedupe_key is not null;

create index if not exists notificacoes_user_unread_idx
  on public.notificacoes (recipient_user_id, lida, created_at desc);

create index if not exists notification_preferences_empresa_idx
  on public.notification_preferences (empresa_id, user_id);

alter table public.notificacoes enable row level security;
alter table public.notification_preferences enable row level security;

drop policy if exists notificacoes_select_own on public.notificacoes;
create policy notificacoes_select_own on public.notificacoes
  for select to authenticated
  using (empresa_id = public.current_empresa_id() and recipient_user_id = auth.uid());

drop policy if exists notificacoes_update_own on public.notificacoes;
create policy notificacoes_update_own on public.notificacoes
  for update to authenticated
  using (empresa_id = public.current_empresa_id() and recipient_user_id = auth.uid())
  with check (empresa_id = public.current_empresa_id() and recipient_user_id = auth.uid());

drop policy if exists notificacoes_delete_own on public.notificacoes;
create policy notificacoes_delete_own on public.notificacoes
  for delete to authenticated
  using (empresa_id = public.current_empresa_id() and recipient_user_id = auth.uid());

drop policy if exists notification_preferences_select_own on public.notification_preferences;
create policy notification_preferences_select_own on public.notification_preferences
  for select to authenticated
  using (user_id = auth.uid() and empresa_id = public.current_empresa_id());

drop policy if exists notification_preferences_insert_own on public.notification_preferences;
create policy notification_preferences_insert_own on public.notification_preferences
  for insert to authenticated
  with check (user_id = auth.uid() and empresa_id = public.current_empresa_id());

drop policy if exists notification_preferences_update_own on public.notification_preferences;
create policy notification_preferences_update_own on public.notification_preferences
  for update to authenticated
  using (user_id = auth.uid() and empresa_id = public.current_empresa_id())
  with check (user_id = auth.uid() and empresa_id = public.current_empresa_id());

grant select, update, delete on public.notificacoes to authenticated;
grant select, insert, update on public.notification_preferences to authenticated;

create or replace function public.lexis_notification_enabled(p_user_id uuid, p_tipo text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select case lower(coalesce(p_tipo, 'sistema'))
      when 'prazo' then prazos when 'djen' then djen when 'datajud' then datajud
      when 'tarefa' then tarefas when 'chat' then chat else sistema end
    from public.notification_preferences where user_id = p_user_id limit 1
  ), true);
$$;

create or replace function public.lexis_insert_notification(
  p_empresa_id uuid, p_user_id uuid, p_tipo text, p_prioridade text,
  p_titulo text, p_corpo text, p_link text, p_dedupe_key text,
  p_processo_id bigint default null, p_source text default null,
  p_meta jsonb default '{}'::jsonb
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_empresa_id is null or p_user_id is null then return; end if;
  if not public.lexis_notification_enabled(p_user_id, p_tipo) then return; end if;
  insert into public.notificacoes (
    empresa_id, recipient_user_id, tipo, prioridade, titulo, corpo, link,
    dedupe_key, processo_id, source, meta, lida, read_at, created_at, updated_at
  ) values (
    p_empresa_id, p_user_id, coalesce(nullif(p_tipo,''),'sistema'),
    coalesce(nullif(p_prioridade,''),'normal'), p_titulo, p_corpo, p_link,
    p_dedupe_key, p_processo_id, p_source, coalesce(p_meta,'{}'::jsonb),
    false, null, now(), now()
  )
  on conflict (empresa_id, recipient_user_id, dedupe_key)
    where dedupe_key is not null
  do update set titulo=excluded.titulo, corpo=excluded.corpo, link=excluded.link,
    prioridade=excluded.prioridade, source=excluded.source, meta=excluded.meta,
    updated_at=now();
end;
$$;

create or replace function public.lexis_process_notification_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_cnj text;
begin
  v_user := new.created_by;
  v_cnj := coalesce(new.protocolo_ref, 'processo');
  if v_user is null then return new; end if;

  if tg_op='UPDATE' then
    if coalesce(new.djen_nova_comunicacao,false)
       and (coalesce(old.djen_nova_comunicacao,false)=false
         or coalesce(new.djen_count,0)>coalesce(old.djen_count,0)
         or new.djen_ultima_data is distinct from old.djen_ultima_data) then
      perform public.lexis_insert_notification(
        new.empresa_id,v_user,'djen','alta','Nova publicação no DJEN',
        coalesce(nullif(new.djen_ultimo_resumo,''),'Há uma nova publicação vinculada ao processo '||v_cnj||'.'),
        '/cases','djen:'||new.id::text||':'||coalesce(new.djen_count,0)::text||':'||coalesce(new.djen_ultima_data::text,''),
        new.id,'processos',jsonb_build_object('cnj',v_cnj,'djen_link',new.djen_ultimo_link)
      );
    end if;

    if coalesce(new.tem_atualizacao_pos_retorno,false)
       and coalesce(old.tem_atualizacao_pos_retorno,false)=false then
      perform public.lexis_insert_notification(
        new.empresa_id,v_user,'datajud','alta','Movimentação nova no tribunal',
        coalesce(nullif(new.datajud_ultimo_nome,''),'O processo '||v_cnj||' teve atualização após o último atendimento.'),
        '/cases','datajud:'||new.id::text||':'||coalesce(new.datajud_hash,new.datajud_ultimo_movimento::text,now()::text),
        new.id,'processos',jsonb_build_object('cnj',v_cnj,'movimento',new.datajud_ultimo_movimento)
      );
    end if;

    if new.proximo_retorno is distinct from old.proximo_retorno
       and new.proximo_retorno is not null
       and new.proximo_retorno <= now()+interval '24 hours'
       and upper(coalesce(new.status,'')) not in ('ENCERRADO','ARQUIVADO','EXTINTO') then
      perform public.lexis_insert_notification(
        new.empresa_id,v_user,'prazo',
        case when new.proximo_retorno<now() then 'critica' else 'alta' end,
        case when new.proximo_retorno<now() then 'Retorno vencido' else 'Retorno próximo' end,
        'Processo '||v_cnj||' · retorno em '||to_char(new.proximo_retorno at time zone 'America/Sao_Paulo','DD/MM/YYYY HH24:MI'),
        '/cases','retorno-change:'||new.id::text||':'||new.proximo_retorno::text,
        new.id,'processos',jsonb_build_object('cnj',v_cnj,'proximo_retorno',new.proximo_retorno)
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_lexis_process_notifications on public.processos;
create trigger trg_lexis_process_notifications after update on public.processos
for each row execute function public.lexis_process_notification_trigger();

create or replace function public.lexis_task_notification_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_due timestamptz;
begin
  if new.assignee_id is null or coalesce(new.feito,false) then return new; end if;
  select u.auth_user_id into v_user from public.usuarios u
   where u.empresa_id=new.empresa_id and (u.id=new.assignee_id or u.auth_user_id=new.assignee_id) limit 1;
  v_user := coalesce(v_user,new.assignee_id);
  v_due := coalesce(new.due_at,new.vencimento::timestamptz);
  if tg_op='INSERT' or new.assignee_id is distinct from old.assignee_id then
    perform public.lexis_insert_notification(
      new.empresa_id,v_user,'tarefa',
      case when v_due is not null and v_due<=now()+interval '24 hours' then 'alta' else 'normal' end,
      'Tarefa atribuída a você',
      coalesce(new.titulo,'Nova tarefa')||case when v_due is not null then ' · prazo '||to_char(v_due at time zone 'America/Sao_Paulo','DD/MM/YYYY HH24:MI') else '' end,
      '/tarefas','task-assigned:'||new.id::text||':'||v_user::text,
      null,'crm_tarefas',jsonb_build_object('tarefa_id',new.id,'due_at',v_due)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_lexis_task_notifications on public.crm_tarefas;
create trigger trg_lexis_task_notifications after insert or update on public.crm_tarefas
for each row execute function public.lexis_task_notification_trigger();

create or replace function public.lexis_subscription_notification_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare u record;
begin
  if tg_op='UPDATE' and new.status is distinct from old.status
     and new.status in ('past_due','suspended','canceled') then
    for u in select auth_user_id from public.usuarios
      where empresa_id=new.empresa_id and auth_user_id is not null
        and cargo in ('Administrador','Supervisor','Superadmin')
    loop
      perform public.lexis_insert_notification(
        new.empresa_id,u.auth_user_id,'sistema','critica',
        case when new.status='past_due' then 'Pagamento pendente'
             when new.status='suspended' then 'Assinatura suspensa'
             else 'Assinatura cancelada' end,
        'O status comercial da empresa mudou para '||new.status||'.',
        '/planos','billing:'||new.id::text||':'||new.status||':'||new.updated_at::text,
        null,'assinaturas',jsonb_build_object('status',new.status,'plano',new.plano)
      );
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_lexis_subscription_notifications on public.assinaturas;
create trigger trg_lexis_subscription_notifications after update on public.assinaturas
for each row execute function public.lexis_subscription_notification_trigger();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='notificacoes'
  ) then
    alter publication supabase_realtime add table public.notificacoes;
  end if;
end $$;
