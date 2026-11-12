-- LexisPredict Ops Suite: workflows, inbox metadata, agent versions, intake, calls and audit.
-- All writes go through authenticated server actions or a validated public intake endpoint.
-- No existing process, WhatsApp or CRM tables are modified.
create extension if not exists pgcrypto;

create table if not exists public.lexis_ops_workflows (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  processo_id bigint references public.processos(id) on delete set null,
  cnj text not null check (length(cnj)=20),
  step_key text not null check (length(step_key) between 2 and 80),
  title text not null check (length(title) between 3 and 200),
  description text not null default '',
  priority text not null default 'normal' check(priority in ('normal','alta','critica')),
  status text not null default 'pendente' check(status in ('pendente','em_andamento','concluido')),
  assigned_auth_id uuid,
  due_at date,
  evidence_url text,
  completed_at timestamptz,
  completed_by uuid,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(empresa_id,cnj,step_key)
);
create index if not exists lexis_ops_workflows_queue on public.lexis_ops_workflows(empresa_id,status,due_at);

create table if not exists public.lexis_ops_inbox (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  phone text not null check (phone ~ '^55[0-9]{10,11}$'),
  cnj text,
  display_name text not null default '',
  state text not null default 'nao_atribuido'
    check(state in ('nao_atribuido','em_atendimento','aguardando','encerrado')),
  assigned_auth_id uuid,
  created_by uuid not null,
  last_activity_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(empresa_id,phone)
);
create index if not exists lexis_ops_inbox_queue on public.lexis_ops_inbox(empresa_id,state,assigned_auth_id);

create table if not exists public.lexis_ops_agents (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  slug text not null check(slug ~ '^[a-z0-9-]{3,80}$'),
  version int not null default 1 check(version between 1 and 100000),
  name text not null,
  instructions text not null,
  tools jsonb not null default '[]'::jsonb,
  max_calls int not null default 3 check(max_calls between 1 and 25),
  human_review boolean not null default true check(human_review=true),
  state text not null default 'rascunho' check(state in ('rascunho','publicado','desativado')),
  created_by uuid not null,
  published_by uuid,
  tested_at timestamptz,
  tested_by uuid,
  test_details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(empresa_id,slug,version)
);
create unique index if not exists lexis_ops_agents_one_published
 on public.lexis_ops_agents(empresa_id,slug) where state='publicado';

create table if not exists public.lexis_ops_forms (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  title text not null check(length(title) between 3 and 200),
  token_hash text not null unique,
  fields jsonb not null default '[]'::jsonb,
  status text not null default 'ativo' check(status in ('ativo','revogado')),
  expires_at timestamptz not null,
  max_submissions integer not null default 100 check(max_submissions between 1 and 10000),
  submissions_count integer not null default 0 check(submissions_count>=0),
  created_by uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists lexis_ops_forms_tenant on public.lexis_ops_forms(empresa_id,created_at desc);

create table if not exists public.lexis_ops_submissions (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  form_id uuid not null references public.lexis_ops_forms(id),
  answers jsonb not null default '{}'::jsonb,
  attachments jsonb not null default '[]'::jsonb,
  reviewed_at timestamptz,
  reviewed_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists lexis_ops_submissions_form on public.lexis_ops_submissions(empresa_id,form_id,created_at desc);

create table if not exists public.lexis_ops_intake_limits (
 form_id uuid not null references public.lexis_ops_forms(id) on delete cascade,
 fingerprint_hash text not null,
 window_start timestamptz not null default now(),
 attempts integer not null default 1,
 primary key(form_id,fingerprint_hash)
);

create table if not exists public.lexis_ops_calls (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  phone text not null,
  cnj text,
  direction text not null check(direction in ('entrada','saida')),
  status text not null check(status in ('nao_atendida','realizada','falhou')),
  provider text not null default 'manual',
  notes text not null default '',
  transcript text not null default '',
  transcript_source text not null default '',
  consent_at timestamptz,
  created_by uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists lexis_ops_calls_tenant on public.lexis_ops_calls(empresa_id,created_at desc);

create table if not exists public.lexis_ops_integrations (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  provider text not null,
  state text not null check(state in ('configurado','nao_configurado','falhou','desconhecido')),
  details text not null default '',
  checked_at timestamptz not null default now(),
  checked_by uuid not null,
  unique(empresa_id,provider)
);
create table if not exists public.lexis_ops_grants (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  user_auth_id uuid not null,
  capability text not null,
  allowed boolean not null,
  granted_by uuid not null,
  updated_at timestamptz not null default now(),
  unique(empresa_id,user_auth_id,capability)
);
create table if not exists public.lexis_ops_audit (
 id bigint generated always as identity primary key,
 empresa_id uuid not null references public.empresas(id),
 actor_auth_id uuid,
 entity text not null,
 entity_id text,
 event text not null,
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists lexis_ops_audit_tenant on public.lexis_ops_audit(empresa_id,created_at desc);

-- Every table is locked down even when a project has legacy default grants.
do $$
declare t text;
begin
 foreach t in array array[
 'lexis_ops_workflows','lexis_ops_inbox','lexis_ops_agents','lexis_ops_forms',
 'lexis_ops_submissions','lexis_ops_intake_limits','lexis_ops_calls',
 'lexis_ops_integrations','lexis_ops_grants','lexis_ops_audit'
 ] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public, anon, authenticated',t);
 end loop;
end $$;

-- Read-only browser access to non-secret operational metadata; writes always server-authorized.
create policy lexis_ops_workflows_read on public.lexis_ops_workflows
 for select to authenticated using (empresa_id = (select public.current_empresa_id()));
create policy lexis_ops_inbox_read on public.lexis_ops_inbox
 for select to authenticated using (empresa_id = (select public.current_empresa_id()));
create policy lexis_ops_integrations_read on public.lexis_ops_integrations
 for select to authenticated using (empresa_id = (select public.current_empresa_id()));
grant select on public.lexis_ops_workflows,public.lexis_ops_inbox,public.lexis_ops_integrations to authenticated;
-- Agent instructions, form tokens, intake submissions, grants and transcripts are server-only.
-- Race-safe atomic intake quota check; only the application service role may invoke it.
create or replace function public.lexis_ops_submit_intake(p_token_hash text,p_answers jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare f public.lexis_ops_forms%rowtype; v_id uuid;
begin
 select * into f from public.lexis_ops_forms where token_hash=p_token_hash for update;
 if not found or f.status<>'ativo' or f.expires_at<=now() or f.submissions_count>=f.max_submissions then
  raise exception 'FORM_UNAVAILABLE' using errcode='22023';
 end if;
 insert into public.lexis_ops_submissions(empresa_id,form_id,answers)
 values (f.empresa_id,f.id,p_answers) returning id into v_id;
 update public.lexis_ops_forms set submissions_count=submissions_count+1 where id=f.id;
 return v_id;
end $$;
revoke all on function public.lexis_ops_submit_intake(text,jsonb) from public,anon,authenticated;
grant execute on function public.lexis_ops_submit_intake(text,jsonb) to service_role;


-- Publish exactly one version of each agent atomically; service-role only.
create or replace function public.lexis_ops_publish_agent(p_agent_id uuid,p_tenant uuid,p_actor uuid)
returns void language plpgsql security definer set search_path=public as $$
declare rec public.lexis_ops_agents%rowtype;
begin
 select * into rec from public.lexis_ops_agents
 where id=p_agent_id and empresa_id=p_tenant and state='rascunho' for update;
 if not found then raise exception 'AGENT_DRAFT_NOT_FOUND' using errcode='22023'; end if;
 if rec.tested_at is null then raise exception 'AGENT_MUST_PASS_TEST' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtext(p_tenant::text||':'||rec.slug));
 update public.lexis_ops_agents set state='desativado',updated_at=now()
 where empresa_id=p_tenant and slug=rec.slug and state='publicado';
 update public.lexis_ops_agents set state='publicado',published_by=p_actor,updated_at=now()
 where id=p_agent_id and empresa_id=p_tenant;
end $$;
revoke all on function public.lexis_ops_publish_agent(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.lexis_ops_publish_agent(uuid,uuid,uuid) to service_role;

-- Rate-limit anonymous form submissions by a *hashed* network fingerprint. Never store IP.
create or replace function public.lexis_ops_intake_slot(p_form uuid,p_fingerprint text)
returns boolean language plpgsql security definer set search_path=public as $$
declare rec public.lexis_ops_intake_limits%rowtype;
begin
 insert into public.lexis_ops_intake_limits(form_id,fingerprint_hash,window_start,attempts)
 values(p_form,p_fingerprint,now(),1)
 on conflict (form_id,fingerprint_hash) do update
 set attempts=case
  when public.lexis_ops_intake_limits.window_start < now()-interval '10 minutes' then 1
  else public.lexis_ops_intake_limits.attempts+1
 end,
 window_start=case
  when public.lexis_ops_intake_limits.window_start < now()-interval '10 minutes' then now()
  else public.lexis_ops_intake_limits.window_start
 end;
 select * into rec from public.lexis_ops_intake_limits
  where form_id=p_form and fingerprint_hash=p_fingerprint;
 return rec.attempts<=3;
end $$;
revoke all on function public.lexis_ops_intake_slot(uuid,text) from public,anon,authenticated;
grant execute on function public.lexis_ops_intake_slot(uuid,text) to service_role;


-- Private attachment bucket: no public object-listing or download policies are granted.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('lexis-intake-private','lexis-intake-private',false,4194304,
 array['application/pdf','image/png','image/jpeg'])
 on conflict(id) do nothing;
