-- Microauditoria barata: revisa métricas já persistidas, sem IA local,
-- sem consulta judicial duplicada e sem atribuir contatos humanos aos agentes.
create or replace function public.hermes_audit_portfolio_gaps(p_day date)
returns integer language plpgsql security invoker set search_path=public
as $body$
declare v_count integer:=0;
begin
 with candidates as (
  select d.empresa_id,v.sector,v.title,v.detail,v.status
  from public.hermes_office_daily d
  cross join lateral (values
   ('operacao','Fila de retornos analisada',
      coalesce((d.metrics->>'overdue')::int,0),
      'Retornos vencidos identificados no CRM; triagem necessária. Não são prazos judiciais.','warning'),
   ('agentes','Cobertura DJEN/DataJud avaliada',
      coalesce((d.metrics->>'staleSources')::int,0),
      'Cadastros com fontes ausentes ou desatualizadas; não comprova ausência de movimentação.','warning'),
   ('provas','Revisões críticas sinalizadas',
      coalesce((d.metrics->>'criticalReviews')::int,0),
      'Revisões com classificação operacional crítica; conferir documentos oficiais.','warning'),
   ('processos','Fontes indisponíveis identificadas',
      coalesce((d.metrics->>'unavailableReviews')::int,0),
      'Revisões sem confirmação completa de DJEN/DataJud; nova checagem necessária.','warning'),
   ('comunicacoes','Rascunhos de contato contabilizados',
      coalesce((d.metrics->>'draftMessages')::int,0),
      'Rascunhos existentes contados para revisão humana, sem envio de mensagem.','completed'),
   ('crm','Indicadores de relacionamento revisados',
      coalesce((d.metrics->>'contacts30d')::int,0),
      'Contatos históricos registrados em 30 dias. Não foram realizados por este agente.','completed')
  ) as v(sector,title,metric_count,detail,status)
  where d.day=p_day and v.metric_count>0
    and not exists(
      select 1 from public.hermes_office_events e
      where e.empresa_id=d.empresa_id and e.sector=v.sector
        and e.kind='portfolio_audit'
        and e.recorded_at >= p_day::timestamptz + interval '3 hours'
        and e.recorded_at < p_day::timestamptz + interval '27 hours'
    )
 ), inserted as (
  insert into public.hermes_office_events(empresa_id,sector,kind,status,title,detail)
   select c.empresa_id,c.sector,'portfolio_audit',c.status,c.title,c.detail
   from candidates c returning 1
 )
 select count(*) into v_count from inserted;
 return v_count;
end
$body$;
revoke all on function public.hermes_audit_portfolio_gaps(date) from public,anon,authenticated;
grant execute on function public.hermes_audit_portfolio_gaps(date) to service_role;

do $schedule$
begin
 if not exists(select 1 from cron.job where jobname='lexis-hermes-portfolio-gap-audit') then
  perform cron.schedule('lexis-hermes-portfolio-gap-audit','35 11,15,19 * * *',
    'select public.hermes_audit_portfolio_gaps((now() at time zone ''America/Sao_Paulo'')::date);');
 end if;
end
$schedule$;
