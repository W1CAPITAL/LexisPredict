-- Align current app write payloads with the legacy/base Supabase schema.
-- Additive only.

alter table public.processos
  add column if not exists risco text,
  add column if not exists djen_nova_comunicacao boolean not null default false,
  add column if not exists djen_ultimo_resumo text,
  add column if not exists djen_ultimo_link text,
  add column if not exists djen_ultima_data timestamptz,
  add column if not exists djen_count integer not null default 0,
  add column if not exists djen_consultado_em timestamptz,
  add column if not exists datajud_hash text,
  add column if not exists indicio_busca_apreensao boolean not null default false,
  add column if not exists busca_apreensao_confianca numeric,
  add column if not exists busca_apreensao_motivo text,
  add column if not exists busca_apreensao_consultado_em timestamptz,
  add column if not exists cumprimento_sentenca_motivo text,
  add column if not exists cumprimento_sentenca_consultado_em timestamptz;

alter table public.crm_tarefas
  add column if not exists negocio_id uuid,
  add column if not exists feito boolean not null default false,
  add column if not exists due_at timestamptz,
  add column if not exists assignee_id uuid,
  add column if not exists created_by uuid,
  add column if not exists updated_at timestamptz not null default now();

update public.crm_tarefas
set feito = case
  when lower(coalesce(status,'')) in ('feito','concluido','concluído','done') then true
  else false
end
where feito = false and status is not null;

update public.crm_tarefas
set due_at = vencimento::timestamptz
where due_at is null and vencimento is not null;

create index if not exists idx_crm_tarefas_empresa_due
  on public.crm_tarefas(empresa_id, due_at);

alter table public.crm_atividades
  add column if not exists titulo text,
  add column if not exists corpo text,
  add column if not exists created_by uuid,
  add column if not exists meta jsonb not null default '{}'::jsonb;

update public.crm_atividades
set corpo = coalesce(corpo, descricao)
where corpo is null and descricao is not null;

alter table public.crm_negocios
  add column if not exists created_by uuid,
  add column if not exists cliente_nome text,
  add column if not exists cliente_doc text,
  add column if not exists cliente_telefone text,
  add column if not exists cliente_email text,
  add column if not exists servico_nome text,
  add column if not exists valor_total numeric not null default 0,
  add column if not exists valor_entrada numeric not null default 0,
  add column if not exists protocolo_cnj text,
  add column if not exists custo_terceiro numeric not null default 0,
  add column if not exists origem text,
  add column if not exists responsavel text,
  add column if not exists observacao text,
  add column if not exists data_fechamento date,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists last_activity_at timestamptz,
  add column if not exists position integer;

update public.crm_negocios
set
  cliente_nome = coalesce(cliente_nome, cliente),
  valor_total = case when valor_total = 0 then coalesce(valor, 0) else valor_total end,
  valor_entrada = case when valor_entrada = 0 then coalesce(entrada, 0) else valor_entrada end,
  protocolo_cnj = coalesce(protocolo_cnj, protocolo_ref)
where cliente_nome is null
   or protocolo_cnj is null
   or valor_total = 0
   or valor_entrada = 0;
