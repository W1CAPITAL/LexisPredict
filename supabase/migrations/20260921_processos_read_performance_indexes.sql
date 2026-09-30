-- Read-path indexes for commercial portfolios with thousands of processes.

create index if not exists idx_processos_empresa_created_at
  on public.processos (empresa_id, created_at desc);

create index if not exists idx_processos_empresa_owner_created_at
  on public.processos (empresa_id, created_by, created_at desc);

create index if not exists idx_processos_empresa_proximo_retorno
  on public.processos (empresa_id, proximo_retorno);

create index if not exists idx_processos_empresa_owner_proximo_retorno
  on public.processos (empresa_id, created_by, proximo_retorno);

create index if not exists idx_processos_empresa_status_created_at
  on public.processos (empresa_id, status, created_at desc);
