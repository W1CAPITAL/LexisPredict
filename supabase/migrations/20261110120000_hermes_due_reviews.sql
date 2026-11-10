-- Hermes3D: verificações judiciais de retorno, separadas do ledger de mensagens.
-- Dados privados: somente service_role através de ações autenticadas no Next.js.
create table if not exists public.hermes_return_reviews (
  id bigint generated always as identity primary key,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  processo_id bigint not null references public.processos(id) on delete cascade,
  due_on date not null,
  state text not null default 'scanning' check (state in ('scanning','ready','unavailable','skipped')),
  attempted_at timestamptz not null default now(),
  checked_at timestamptz,
  djen_ok boolean not null default false,
  datajud_ok boolean not null default false,
  priority_score integer not null default 0 check (priority_score between 0 and 100),
  priority_label text not null default 'Não aplicável',
  highlights jsonb not null default '[]'::jsonb,
  message_draft text,
  suggested_next_return date,
  source_snapshot jsonb not null default '{}'::jsonb,
  unique (empresa_id, processo_id, due_on)
);
create index if not exists hermes_return_reviews_tenant_queue
  on public.hermes_return_reviews (empresa_id, priority_score desc, checked_at desc);
create index if not exists hermes_return_reviews_by_process
  on public.hermes_return_reviews (empresa_id, processo_id, due_on desc);
alter table public.hermes_return_reviews enable row level security;
revoke all on public.hermes_return_reviews from anon, authenticated;
grant select, insert, update, delete on public.hermes_return_reviews to service_role;
grant usage, select on sequence public.hermes_return_reviews_id_seq to service_role;

-- SECURITY INVOKER: chamada somente pelo service_role, que já tem escopo servidor.
-- Reserva atômica para impedir múltiplas consultas concorrentes do mesmo vencimento.
create or replace function public.hermes_claim_due_review(p_today date)
returns table (empresa_id uuid, processo_id bigint, due_on date)
language sql security invoker
set search_path = public
as $$
  with candidate as (
    select p.id, p.empresa_id, p.proximo_retorno
    from public.processos p
    left join public.hermes_return_reviews r
      on r.empresa_id = p.empresa_id
      and r.processo_id = p.id
      and r.due_on = p.proximo_retorno
    where p.empresa_id is not null
      and p.proximo_retorno <= p_today
      and (r.id is null
        or (r.state = 'unavailable' and r.attempted_at < now() - interval '4 hours')
        or (r.state = 'scanning' and r.attempted_at < now() - interval '15 minutes'))
    order by p.proximo_retorno asc, p.id asc
    limit 1
  ), claimed as (
    insert into public.hermes_return_reviews (empresa_id, processo_id, due_on, state, attempted_at)
    select c.empresa_id, c.id, c.proximo_retorno, 'scanning', now() from candidate c
    on conflict (empresa_id, processo_id, due_on)
    do update set state = 'scanning', attempted_at = now()
    where (hermes_return_reviews.state = 'unavailable' and hermes_return_reviews.attempted_at < now() - interval '4 hours')
       or (hermes_return_reviews.state = 'scanning' and hermes_return_reviews.attempted_at < now() - interval '15 minutes')
    returning hermes_return_reviews.empresa_id, hermes_return_reviews.processo_id, hermes_return_reviews.due_on
  )
  select c.empresa_id, c.processo_id, c.due_on from claimed c;
$$;
revoke all on function public.hermes_claim_due_review(date) from public, anon, authenticated;
grant execute on function public.hermes_claim_due_review(date) to service_role;

comment on table public.hermes_return_reviews is
  'Rascunhos internos auditáveis para retornos agendados. Consulta não representa atendimento, envio, ou prazo processual.';
