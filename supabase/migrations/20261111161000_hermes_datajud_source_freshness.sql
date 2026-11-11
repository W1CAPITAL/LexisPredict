-- Registra o tempo declarado pelo DataJud, separado do horário da consulta.
-- Não concede acesso adicional: herda RLS/permissões de hermes_portfolio_scans.
alter table public.hermes_portfolio_scans
 add column if not exists datajud_indexed_at timestamptz,
 add column if not exists datajud_updated_at timestamptz;

comment on column public.hermes_portfolio_scans.datajud_indexed_at
 is 'DataJud @timestamp: indexação informada pelo CNJ; não equivale a último movimento nem a atualização em tempo real.';
comment on column public.hermes_portfolio_scans.datajud_updated_at
 is 'DataJud dataHoraUltimaAtualizacao: atualização da origem do dado, distinta do instante de verificação Hermes.';
