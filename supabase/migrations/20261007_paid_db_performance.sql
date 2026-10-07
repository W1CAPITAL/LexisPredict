-- LexisPredict — índices para carteira grande / banco pago
-- Não remove dados e pode ser executado mais de uma vez.

create index if not exists idx_processos_empresa_created
  on public.processos (empresa_id, created_at desc);

create index if not exists idx_processos_empresa_status_created
  on public.processos (empresa_id, status, created_at desc);

create index if not exists idx_processos_empresa_owner_created
  on public.processos (empresa_id, created_by, created_at desc);

create index if not exists idx_processos_empresa_protocolo
  on public.processos (empresa_id, protocolo_ref);

create index if not exists idx_processos_empresa_ultimo_retorno
  on public.processos (empresa_id, ultimo_retorno desc);

create index if not exists idx_processos_empresa_proximo_retorno
  on public.processos (empresa_id, proximo_retorno);

create index if not exists idx_auditoria_empresa_created
  on public.auditoria_logs_app (empresa_id, created_at desc);

create index if not exists idx_auditoria_empresa_action_created
  on public.auditoria_logs_app (empresa_id, action, created_at desc);

create index if not exists idx_whatsapp_empresa_contact_time
  on public.whatsapp_messages (empresa_id, contact_number, timestamp desc);

create index if not exists idx_usuarios_empresa_nome
  on public.usuarios (empresa_id, nome);
