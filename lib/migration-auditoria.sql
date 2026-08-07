-- ============================================================================
-- LEXISPREDICT — MIGRAÇÃO: AUDITORIA OPERACIONAL (auditoria_logs_app)
-- Execute este script no Supabase SQL Editor (uma única vez por banco).
-- Registra quem atendeu, editou ou apagou cada processo da empresa.
-- ============================================================================

create table if not exists public.auditoria_logs_app (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  auth_user_id text,
  user_nome text,
  action text not null,            -- 'atendimento' | 'edicao' | 'exclusao' | 'criacao'
  protocolo_ref text not null,
  detalhes jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Índices para consultas rápidas por empresa e por processo
create index if not exists idx_auditoria_logs_app_empresa
  on public.auditoria_logs_app (empresa_id, created_at desc);

create index if not exists idx_auditoria_logs_app_protocolo
  on public.auditoria_logs_app (protocolo_ref);

-- RLS: apenas leitura/escrita via service_role (server actions). Se a empresa
-- já usa RLS por coluna, ajuste a policy conforme o seu padrão.
alter table public.auditoria_logs_app enable row level security;

create policy if not exists "Auditoria log app - insert via service"
  on public.auditoria_logs_app for insert
  to service_role with check (true);

create policy if not exists "Auditoria log app - read all"
  on public.auditoria_logs_app for select
  to authenticated, anon using (true);

-- ============================================================================
-- SEMAFORO DE ATENDIMENTO DA SEMANA
-- A contagem de "atendidos na semana" usa ultimo_retorno (data em que o
-- atendente registrou o retorno). Nada a migrar aqui: a coluna já existe.
-- ============================================================================
