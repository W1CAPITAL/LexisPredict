-- Datas informadas pelo escritório não são atos judiciais automaticamente verificados.
alter table public.audiencias_monitoradas
  drop constraint if exists audiencias_monitoradas_fonte_check;
alter table public.audiencias_monitoradas
  add constraint audiencias_monitoradas_fonte_check
  check (fonte in ('DJEN','DataJud','TJPR PROJUDI','NOTIFICACAO'));
alter table public.audiencias_monitoradas
  drop constraint if exists audiencias_monitoradas_situacao_check;
alter table public.audiencias_monitoradas
  add constraint audiencias_monitoradas_situacao_check
  check (situacao in ('publicada','data_pendente','cancelada','informada'));
comment on column public.audiencias_monitoradas.fonte is
  'NOTIFICACAO é uma informação recebida, não uma consulta oficial.';
comment on column public.audiencias_monitoradas.situacao is
  'informada: audiência recebida de terceiro, aguardando confirmação independente no tribunal.';
