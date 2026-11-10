-- Auditoria individual autorizada pelo backend apenas para sua empresa.
create or replace function public.hermes_rebuild_company_evidence(p_empresa uuid,p_day date)
returns integer language plpgsql security invoker set search_path=public
as $body$
declare v_changed integer:=0;
begin
 with measured as (
  select d.empresa_id,d.day,d.metrics,
   (select count(*)::int from public.hermes_return_reviews r
    where r.empresa_id=p_empresa and r.attempted_at>now()-interval '30 days'
      and r.state='ready' and (r.djen_ok or r.datajud_ok)) evidence,
   (select count(*)::int from public.hermes_office_events e
    where e.empresa_id=p_empresa and e.recorded_at>now()-interval '30 days'
      and e.kind in('judicial_scan','portfolio_audit')) findings
  from public.hermes_office_daily d
  where d.empresa_id=p_empresa and d.day=p_day
 ), proposals as (
  select m.*,
   jsonb_build_array(
    jsonb_build_object('sector','processos','action',
     case when coalesce((m.metrics->>'unavailableReviews')::int,0)>0
      then 'Reconsultar as fontes DJEN/DataJud incompletas após o intervalo seguro.'
      else 'Continuar consultas agendadas somente para retornos abertos.' end,
     'evidence',coalesce((m.metrics->>'unavailableReviews')::int,0),
     'automated',true,'status','retry_policy_active'),
    jsonb_build_object('sector','operacao','action',
     case when coalesce((m.metrics->>'overdue')::int,0)>0
      then 'Manter os retornos vencidos ativos no início da fila de atendimento.'
      else 'Nenhum retorno vencido ativo no resumo atual.' end,
     'evidence',coalesce((m.metrics->>'overdue')::int,0),
     'automated',true,'status','priority_policy_active'),
    jsonb_build_object('sector','agentes','action',
     case when coalesce((m.metrics->>'staleSources')::int,0)>0
      then 'Propor ajuste do scanner de fontes vencidas após comparar resultados reais.'
      else 'Manter métricas de saúde e verificação dos conectores.' end,
     'evidence',coalesce((m.metrics->>'staleSources')::int,0),
     'automated',false,'status','awaits_code_review')
   ) recommendations
  from measured m
 ), changed as (
  insert into public.hermes_rebuild_runs(empresa_id,day,state,input_metrics,recommendations,findings_count,evidence_count)
  select empresa_id,day,case when findings+evidence>0 then 'audited' else 'no_changes' end,
   metrics,recommendations,findings,evidence from proposals
  on conflict(empresa_id,day) do update set
   input_metrics=excluded.input_metrics,recommendations=excluded.recommendations,
   findings_count=excluded.findings_count,evidence_count=excluded.evidence_count,
   state=excluded.state,recorded_at=now()
  where hermes_rebuild_runs.input_metrics is distinct from excluded.input_metrics
     or hermes_rebuild_runs.findings_count is distinct from excluded.findings_count
     or hermes_rebuild_runs.evidence_count is distinct from excluded.evidence_count
  returning empresa_id,findings_count,evidence_count
 ), audit as (
  insert into public.hermes_office_events(empresa_id,sector,kind,status,title,detail)
  select empresa_id,'agentes','swarm_rebuild','completed',
     'Swarm Rebuild: diagnóstico auditado',
     evidence_count::text||' revisões verificadas e '||findings_count::text||
     ' eventos inspecionados. Melhorias automáticas limitadas a triagem e retentativas; alterações de código exigem testes.'
  from changed returning 1
 ) select count(*) into v_changed from audit;
 return v_changed;
end
$body$;
revoke all on function public.hermes_rebuild_company_evidence(uuid,date) from public,anon,authenticated;
grant execute on function public.hermes_rebuild_company_evidence(uuid,date) to service_role;
