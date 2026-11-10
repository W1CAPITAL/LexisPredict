-- Align scheduled scans, office counters and portfolio diagnostics with valid return dates.
-- 0–19-day gaps after last attendance are suspicious scheduling data, never overdue returns.
-- Preserve source dates for human confirmation; no automatic client contact.
alter table public.hermes_return_reviews drop constraint if exists hermes_return_reviews_state_check;
alter table public.hermes_return_reviews add constraint hermes_return_reviews_state_check
 check (state in ('scanning','ready','partial','unavailable','skipped'));
update public.hermes_return_reviews set state='partial'
 where state='ready' and (djen_ok is not true or datajud_ok is not true);

CREATE OR REPLACE FUNCTION public.hermes_claim_due_review(p_today date)
 RETURNS TABLE(empresa_id uuid, processo_id bigint, due_on date)
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
 with candidate as (
  select p.id,p.empresa_id,p.proximo_retorno
  from public.processos p
  left join public.hermes_return_reviews r
   on r.empresa_id=p.empresa_id and r.processo_id=p.id and r.due_on=p.proximo_retorno
  where p.empresa_id is not null and p.ultimo_retorno is not null and p.proximo_retorno-p.ultimo_retorno >= 20 and p.proximo_retorno<=p_today
   and upper(btrim(coalesce(p.status_interno,''))) not in ('ENCERRADO','FINALIZADO','ARQUIVADO')
   and upper(btrim(coalesce(p.status,''))) not in ('ENCERRADO','FINALIZADO','ARQUIVADO')
   and upper(btrim(coalesce(p.dados->>'situacao',''))) not in ('ENCERRADO','FINALIZADO','ARQUIVADO')
   and (r.id is null
    or (r.state='unavailable' and r.attempted_at<now()-interval '30 minutes')
    or (r.state='partial' and (r.djen_ok is not true or r.datajud_ok is not true)
       and r.attempted_at<now()-interval '45 minutes')
    or (r.state='scanning' and r.attempted_at<now()-interval '12 minutes'))
  order by (case when p.proximo_retorno=p_today then 0 else 1 end),
           p.proximo_retorno asc,p.id asc limit 1
 ), claimed as (
  insert into public.hermes_return_reviews(empresa_id,processo_id,due_on,state,attempted_at)
  select empresa_id,id,proximo_retorno,'scanning',now() from candidate
  on conflict on constraint hermes_return_reviews_scope_due_unique
  do update set state='scanning',attempted_at=now()
  where (hermes_return_reviews.state='unavailable' and hermes_return_reviews.attempted_at<now()-interval '30 minutes')
   or (hermes_return_reviews.state='partial'
      and (hermes_return_reviews.djen_ok is not true or hermes_return_reviews.datajud_ok is not true)
      and hermes_return_reviews.attempted_at<now()-interval '45 minutes')
   or (hermes_return_reviews.state='scanning' and hermes_return_reviews.attempted_at<now()-interval '12 minutes')
  returning hermes_return_reviews.empresa_id,hermes_return_reviews.processo_id,hermes_return_reviews.due_on
 )
 select claimed.empresa_id,claimed.processo_id,claimed.due_on from claimed;
$function$;

CREATE OR REPLACE FUNCTION public.hermes_refresh_office_daily(p_day date)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_count integer:=0;
begin
  with portfolio as (
    select p.empresa_id,
      count(*)::int total,
      count(*) filter(where upper(btrim(coalesce(p.status_interno,''))) not in ('ENCERRADO','FINALIZADO','ARQUIVADO') and upper(btrim(coalesce(p.status,''))) not in ('ENCERRADO','FINALIZADO','ARQUIVADO') and upper(btrim(coalesce(p.dados->>'situacao',''))) not in ('ENCERRADO','FINALIZADO','ARQUIVADO'))::int active,
      count(*) filter(where p.ultimo_retorno is not null and p.proximo_retorno-p.ultimo_retorno >= 20 and p.proximo_retorno<=p_day and
         upper(btrim(coalesce(p.status_interno,''))) not in ('ENCERRADO','FINALIZADO','ARQUIVADO') and upper(btrim(coalesce(p.status,''))) not in ('ENCERRADO','FINALIZADO','ARQUIVADO') and upper(btrim(coalesce(p.dados->>'situacao',''))) not in ('ENCERRADO','FINALIZADO','ARQUIVADO'))::int overdue,
      count(*) filter(where (p.tem_atualizacao_pos_retorno or p.djen_nova_comunicacao) and
         upper(btrim(coalesce(p.status_interno,''))) not in ('ENCERRADO','FINALIZADO','ARQUIVADO') and upper(btrim(coalesce(p.status,''))) not in ('ENCERRADO','FINALIZADO','ARQUIVADO') and upper(btrim(coalesce(p.dados->>'situacao',''))) not in ('ENCERRADO','FINALIZADO','ARQUIVADO'))::int alerts,
      count(*) filter(where upper(btrim(coalesce(p.status_interno,''))) not in ('ENCERRADO','FINALIZADO','ARQUIVADO') and upper(btrim(coalesce(p.status,''))) not in ('ENCERRADO','FINALIZADO','ARQUIVADO') and upper(btrim(coalesce(p.dados->>'situacao',''))) not in ('ENCERRADO','FINALIZADO','ARQUIVADO') and
         (greatest(p.djen_consultado_em,p.datajud_consultado_em) is null or
          greatest(p.djen_consultado_em,p.datajud_consultado_em)<(now()-interval '21 days')))::int stale_sources
    from public.processos p where p.empresa_id is not null group by p.empresa_id
  ), reviews as (
    select empresa_id,
      count(*) filter(where state='ready')::int ready_reviews,
      count(*) filter(where state in ('unavailable','partial'))::int unavailable_reviews,
      count(*) filter(where state='ready' and priority_score>=90)::int critical_reviews,
      count(*) filter(where state='ready' and coalesce(message_draft,'')<>'')::int draft_messages,
      count(*) filter(where (djen_ok or datajud_ok))::int checked_sources
    from public.hermes_return_reviews
    where attempted_at>=now()-interval '30 days'
    group by empresa_id
  ), work as (
    select empresa_id,count(*)::int activities,
      count(*) filter(where contato_cliente_confirmado=true)::int contacts
    from public.tarefas_realizadas
    where data_realizacao>=p_day-interval '30 days' and data_realizacao<=p_day
    group by empresa_id
  ), inserted as (
    insert into public.hermes_office_daily(empresa_id,day,metrics,updated_at)
    select p.empresa_id,p_day,jsonb_build_object(
      'total',p.total,'active',p.active,'overdue',p.overdue,'alerts',p.alerts,
      'staleSources',p.stale_sources,
      'readyReviews',coalesce(r.ready_reviews,0),
      'unavailableReviews',coalesce(r.unavailable_reviews,0),
      'criticalReviews',coalesce(r.critical_reviews,0),
      'draftMessages',coalesce(r.draft_messages,0),
      'checkedSources30d',coalesce(r.checked_sources,0),
      'completedActivities30d',coalesce(w.activities,0),
      'contacts30d',coalesce(w.contacts,0)
    ),now()
    from portfolio p
    left join reviews r on r.empresa_id=p.empresa_id
    left join work w on w.empresa_id=p.empresa_id
    on conflict(empresa_id,day) do update
      set metrics=excluded.metrics,updated_at=now()
    returning 1
  )
  select count(*) into v_count from inserted;
  return v_count;
end
$function$;

CREATE OR REPLACE FUNCTION public.hermes_refresh_portfolio_diagnostics(p_day date)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_company uuid;v_count integer:=0;v_payload jsonb;v_previous jsonb;v_prev_day date;
begin
 for v_company in select distinct empresa_id from public.processos where empresa_id is not null loop
  select payload,day into v_previous,v_prev_day
    from public.hermes_portfolio_diagnostics
    where empresa_id=v_company and day<p_day order by day desc limit 1;

  with last_reviews as (
    select distinct on (r.processo_id) r.processo_id,r.state,r.djen_ok,r.datajud_ok,r.priority_score,
      r.checked_at,r.attempted_at
    from public.hermes_return_reviews r where r.empresa_id=v_company
    order by r.processo_id,r.attempted_at desc
  ), base as (
    select p.id,p.empresa_id,
      left(coalesce(nullif(btrim(p.cliente),''),'Cliente não identificado'),100) client,
      left(coalesce(p.protocolo_ref,''),35) cnj,
      left(coalesce(nullif(btrim(p.advogado),''),'Sem advogado identificado'),100) lawyer,
      left(coalesce(nullif(btrim(p.escritorio),''),'Sem escritório identificado'),100) office,
      coalesce(p.status_interno,p.status,'Sem status') case_status,
      p.proximo_retorno,p.ultimo_retorno,p.proximo_prazo,
      p.datajud_consultado_em,p.djen_consultado_em,
      p.djen_last_ok,p.datajud_last_ok,
      p.djen_last_error,p.datajud_last_error,
      p.tem_atualizacao_pos_retorno,p.djen_nova_comunicacao,
      p.is_procedente,p.procedente_motivo,
      coalesce(r.state,'sem revisão') review_state,r.djen_ok review_djen_ok,
      r.datajud_ok review_datajud_ok,r.priority_score review_priority,
      (
        upper(btrim(coalesce(p.status_interno,''))) ~ '^(ENCERRAD|FINALIZAD|ARQUIVAD|EXTINT)'
        or upper(btrim(coalesce(p.status,''))) ~ '^(ENCERRAD|FINALIZAD|ARQUIVAD|EXTINT)'
        or upper(btrim(coalesce(p.dados->>'situacao',''))) ~ '^(ENCERRAD|FINALIZAD|ARQUIVAD|EXTINT)'
      ) closed,
      upper(coalesce(nullif(btrim(p.procedente_motivo),''),nullif(btrim(p.dados->>'procedente_motivo'),''),'')) outcome_raw
    from public.processos p left join last_reviews r on r.processo_id=p.id
    where p.empresa_id=v_company
  ), observations as (
    select b.*,
      (not b.closed and b.ultimo_retorno is not null and b.proximo_retorno-b.ultimo_retorno >= 20 and b.proximo_retorno<=p_day) as overdue_return,
      (not b.closed and b.ultimo_retorno is not null and b.proximo_retorno is not null and b.proximo_retorno-b.ultimo_retorno < 20) as inconsistent_return,
      (not b.closed and b.proximo_prazo<=p_day) as registered_deadline,
      (not b.closed and (greatest(b.datajud_consultado_em,b.djen_consultado_em) is null
        or greatest(b.datajud_consultado_em,b.djen_consultado_em)<(now()-interval '21 days'))) as source_stale,
      (not b.closed and (coalesce(b.tem_atualizacao_pos_retorno,false) or coalesce(b.djen_nova_comunicacao,false))) as movement_flag,
      (not b.closed and b.review_state in('unavailable','scanning')) as incomplete_review,
      (not b.closed and (b.lawyer='Sem advogado identificado' or b.office='Sem escritório identificado')) as responsible_missing,
      case
        when b.outcome_raw ~ '(PARCIAL|EM PARTE)' then 'parcial_indicada'
        when b.outcome_raw ~ 'IMPROCED' then 'improcedente_indicada'
        when b.outcome_raw ~ '(PROCED|PROVIMENTO)' then 'procedente_indicada'
        else 'indeterminado'
      end outcome_label,
      least(100,
        (case when not b.closed and b.ultimo_retorno is not null and b.proximo_retorno-b.ultimo_retorno >= 20 and b.proximo_retorno<=p_day then 35 else 0 end)+
        (case when not b.closed and b.proximo_prazo<=p_day then 25 else 0 end)+
        (case when not b.closed and (greatest(b.datajud_consultado_em,b.djen_consultado_em) is null
          or greatest(b.datajud_consultado_em,b.djen_consultado_em)<now()-interval '21 days') then 20 else 0 end)+
        (case when not b.closed and (coalesce(b.tem_atualizacao_pos_retorno,false) or coalesce(b.djen_nova_comunicacao,false)) then 15 else 0 end)+
        (case when not b.closed and b.review_state in('unavailable','scanning') then 15 else 0 end)+
        (case when not b.closed and (b.lawyer='Sem advogado identificado' or b.office='Sem escritório identificado') then 10 else 0 end)+
        (case when not b.closed and (b.ultimo_retorno is null or b.ultimo_retorno<p_day-interval '35 days') then 10 else 0 end)
      ) as score,
      (
        b.datajud_consultado_em is not null and b.datajud_last_ok is false
        or b.djen_consultado_em is not null and b.djen_last_ok is false
      ) source_error
    from base b
  ), scored as (
    select o.*,
      100-o.score as health,
      case when o.score>=70 then 'Crítica'
        when o.score>=40 then 'Atenção'
        else 'Monitoramento' end severity,
      to_jsonb(array_remove(array[
        case when o.overdue_return then 'Retorno administrativo vencido' end,
        case when o.inconsistent_return then 'Data de retorno inconsistente com o último atendimento; não classificar como vencimento' end,
        case when o.registered_deadline then 'Prazo cadastrado vencido — conferir no tribunal' end,
        case when o.source_stale then 'Consulta judicial desatualizada' end,
        case when o.movement_flag then 'Sinal de movimentação ainda pendente de conferência' end,
        case when o.incomplete_review then 'Revisão judicial incompleta' end,
        case when o.responsible_missing then 'Cadastro de responsável incompleto' end
      ]::text[],null::text)) as reasons
    from observations o
  ), metrics as (
    select
      count(*)::int total,
      count(*) filter(where not closed)::int active,
      count(*) filter(where closed)::int closed,
      count(*) filter(where overdue_return)::int overdue_returns,
      count(*) filter(where inconsistent_return)::int invalid_return_dates,
      count(*) filter(where registered_deadline)::int registered_deadlines_due,
      count(*) filter(where source_stale)::int stale_sources,
      count(*) filter(where lawyer='Sem advogado identificado')::int missing_lawyer,
      count(*) filter(where office='Sem escritório identificado')::int missing_office,
      count(*) filter(where not closed and severity='Crítica')::int critical,
      count(*) filter(where not closed and severity='Atenção')::int attention,
      count(*) filter(where not closed and severity='Monitoramento')::int monitoring,
      coalesce(round(avg(health) filter(where not closed))::int,0) average_health,
      count(*) filter(where source_error)::int source_errors,
      count(*) filter(where outcome_label='improcedente_indicada')::int improcedente_indicada,
      count(*) filter(where outcome_label='procedente_indicada')::int procedente_indicada,
      count(*) filter(where outcome_label='parcial_indicada')::int parcial_indicada,
      count(*) filter(where outcome_label='indeterminado')::int indeterminado,
      count(*) filter(where is_procedente=true and outcome_label='indeterminado')::int flag_without_evidence
    from scored
  ), open_tasks as (
    select t.*,
      coalesce(nullif(u.nome,''),case when nullif(btrim(t.assignee_id),'') is not null then 'Responsável sem vínculo no cadastro' end,'Não atribuído') as assigned_name
    from public.crm_tarefas t left join public.usuarios u
      on u.empresa_id=t.empresa_id and u.auth_user_id::text=t.assignee_id
    where t.empresa_id=v_company
  ), tasks as (
    select count(*) filter(where not feito)::int open_count,
      count(*) filter(where not feito and due_at<p_day)::int overdue_count,
      count(*) filter(where not feito and assigned_name='Responsável sem vínculo no cadastro')::int unmatched_count,
      count(*) filter(where not feito and due_at<p_day and assigned_name='Responsável sem vínculo no cadastro')::int unmatched_overdue
    from open_tasks
  ), work as (
    select count(*)::int completed,
      count(*) filter(where contato_cliente_confirmado=true)::int confirmed
    from public.tarefas_realizadas t
    where t.empresa_id=v_company and t.data_realizacao between p_day-30 and p_day
  ), outstanding_closed as (
    -- Only CRM tasks whose business identifier explicitly matches a closed process.
    -- Never infer "open" from historical completed activities.
    select count(*)::int total
    from public.crm_tarefas t join scored s on s.id::text=t.negocio_id
    where t.empresa_id=v_company and s.closed and not t.feito
  ), lawyer_summary as (
    select coalesce(jsonb_agg(to_jsonb(x) order by x.critical desc,x.active desc,x.name), '[]'::jsonb) result
    from (
      select lawyer name,count(*)::int total,
        count(*) filter(where not closed)::int active,
        count(*) filter(where not closed and severity='Crítica')::int critical,
        count(*) filter(where overdue_return)::int overdue,
        coalesce(round(avg(health) filter(where not closed))::int,0) "avgHealth",
        count(*) filter(where source_stale)::int "sourceGaps"
      from scored group by lawyer
    ) x
  ), office_summary as (
    select coalesce(jsonb_agg(to_jsonb(x) order by x.critical desc,x.active desc,x.name),'[]'::jsonb) result
    from (
      select office name,count(*)::int total,
        count(*) filter(where not closed)::int active,
        count(*) filter(where not closed and severity='Crítica')::int critical,
        count(*) filter(where overdue_return)::int overdue,
        coalesce(round(avg(health) filter(where not closed))::int,0) "avgHealth",
        count(*) filter(where source_stale)::int "sourceGaps"
      from scored group by office
    ) x
  ), user_summary as (
    select coalesce(jsonb_agg(to_jsonb(x) order by x."done30d" desc,x.name),'[]'::jsonb) result
    from (
      select left(coalesce(u.nome,'Colaborador'),100) name,
        left(coalesce(u.cargo,u.role,'Não informado'),60) role,
        (select count(*)::int from public.tarefas_realizadas r
         where r.empresa_id=v_company and r.responsavel_auth_user_id=u.auth_user_id
           and r.data_realizacao between p_day-30 and p_day) "done30d",
        (select count(*)::int from public.tarefas_realizadas r
         where r.empresa_id=v_company and r.responsavel_auth_user_id=u.auth_user_id
           and r.data_realizacao between p_day-30 and p_day
           and r.contato_cliente_confirmado=true) "contacts30d",
        (select count(distinct r.processo_id)::int from public.tarefas_realizadas r
         where r.empresa_id=v_company and r.responsavel_auth_user_id=u.auth_user_id
           and r.data_realizacao between p_day-30 and p_day) "distinctCases",
        (select count(*)::int from public.crm_tarefas t
         where t.empresa_id=v_company and t.assignee_id=u.auth_user_id::text and not t.feito) "openTasks",
        (select count(*)::int from public.crm_tarefas t
         where t.empresa_id=v_company and t.assignee_id=u.auth_user_id::text
           and not t.feito and t.due_at<p_day) "overdueTasks"
      from public.usuarios u where u.empresa_id=v_company
    ) x
  ), case_summary as (
    select coalesce(jsonb_agg(to_jsonb(x) order by x.score desc,x."nextReturn" asc nulls last),'[]'::jsonb) result
    from (
      select id "processId",client,cnj,lawyer,office,severity,score,health,
        left(case_status,70) status,
        case outcome_label
          when 'parcial_indicada' then 'Parcial indicada no cadastro'
          when 'improcedente_indicada' then 'Improcedência indicada no cadastro'
          when 'procedente_indicada' then 'Procedência indicada no cadastro'
          else 'Não determinado' end outcome,
        reasons,proximo_retorno "nextReturn"
      from scored where not closed
      order by score desc,proximo_retorno asc nulls last,id asc limit 35
    ) x
  ), task_queue as (
    select coalesce(jsonb_agg(to_jsonb(x) order by x."dueOn" asc nulls last,x.title),'[]'::jsonb) result
    from (
      select left(coalesce(titulo,'Tarefa sem título'),160) title,
        left(assigned_name,100) assignee,
        due_at "dueOn",feito done,coalesce(ocorrencias_total,1) occurrences
      from open_tasks where not feito
      order by due_at asc nulls last,created_at desc limit 30
    ) x
  ), totals as (
    select m.*,t.open_count,t.overdue_count,t.unmatched_count,t.unmatched_overdue,w.completed,w.confirmed,
      o.total closed_with_open_task
    from metrics m cross join tasks t cross join work w cross join outstanding_closed o
  )
  select jsonb_build_object(
     'day',p_day,'generatedAt',now(),'total',a.total,'active',a.active,'closed',a.closed,
     'overdueReturns',a.overdue_returns,'invalidReturnDates',a.invalid_return_dates,'registeredDeadlinesDue',a.registered_deadlines_due,
     'staleSources',a.stale_sources,'missingLawyer',a.missing_lawyer,'missingOffice',a.missing_office,
     'critical',a.critical,'attention',a.attention,'monitoring',a.monitoring,
     'averageHealth',a.average_health,'sourceErrors',a.source_errors,
     'closedWithOpenTask',a.closed_with_open_task,
     'openCrmTasks',a.open_count,'overdueCrmTasks',a.overdue_count,
     'unmatchedAssigneeTasks',a.unmatched_count,'unmatchedOverdueTasks',a.unmatched_overdue,
     'completedHumanTasks30d',a.completed,'contactsConfirmed30d',a.confirmed,
     'unconfirmedOutcomes',a.indeterminado,
     'merits',jsonb_build_object('improcedenteIndicada',a.improcedente_indicada,
       'procedenteIndicada',a.procedente_indicada,'parcialIndicada',a.parcial_indicada,
       'indeterminado',a.indeterminado,'flagWithoutEvidence',a.flag_without_evidence),
     'byLawyer',(select result from lawyer_summary),
     'byOffice',(select result from office_summary),
     'byUser',(select result from user_summary),
     'topCases',(select result from case_summary),
     'taskQueue',(select result from task_queue),
     'recommendations',jsonb_build_array(
       jsonb_build_object('priority',case when a.overdue_returns>0 then 'Alta' else 'Rotina' end,
         'sector','Operação','title','Retornos administrativos',
         'reason',a.overdue_returns::text||' cadastros abertos vencidos.',
         'action','Priorizar os retornos cadastrados, mantendo fora os encerrados.','automated',true),
       jsonb_build_object('priority',case when a.registered_deadlines_due>0 then 'Alta' else 'Rotina' end,
         'sector','Jurídico','title','Prazos cadastrados',
         'reason',a.registered_deadlines_due::text||' datas cadastradas em atraso ou hoje.',
         'action','Validar no portal oficial e com advogado; um campo no CRM não prova prazo judicial.','automated',false),
       jsonb_build_object('priority',case when a.stale_sources>0 then 'Alta' else 'Rotina' end,
         'sector','Fontes oficiais','title','Atualização DJEN/DataJud',
         'reason',a.stale_sources::text||' processos ativos sem fonte recente.',
         'action','Reconsultar com limite de tentativas; preservar diagnósticos e revisão humana.','automated',true),
       jsonb_build_object('priority',case when a.missing_lawyer+a.missing_office>0 then 'Atenção' else 'Rotina' end,
         'sector','Cadastros','title','Responsáveis incompletos',
         'reason',a.missing_lawyer::text||' sem advogado e '||a.missing_office::text||' sem escritório.',
         'action','Conferir documentos e vincular responsáveis corretos, sem inventar nomes.','automated',false),
       jsonb_build_object('priority',case when a.unmatched_count>0 then 'Alta' else 'Rotina' end,
         'sector','Equipe','title','Vinculação de responsáveis',
         'reason',a.unmatched_count::text||' tarefas abertas sem correspondência com a tabela atual da equipe; '||
           ' conferir vínculos sem inferir vencimento.',
         'action','Conferir IDs e vincular aos colaboradores reais, preservando histórico e sem atribuir automaticamente.',
         'automated',false),
       jsonb_build_object('priority',case when a.open_count>25 then 'Atenção' else 'Rotina' end,
         'sector','Equipe','title','Tarefas da fila',
         'reason',a.open_count::text||' tarefas operacionais abertas (não são retornos vencidos).',
         'action','Revisar distribuição, vencimento e registros repetidos; manter histórico auditável.','automated',false),
       jsonb_build_object('priority',case when a.indeterminado>0 then 'Atenção' else 'Rotina' end,
         'sector','Mérito','title','Qualidade dos desfechos',
         'reason',a.indeterminado::text||' processos sem categoria de mérito determinável pela justificativa cadastrada.',
         'action','Conferir sentença e recursos antes de classificar procedência ou improcedência.','automated',false),
       jsonb_build_object('priority','Melhoria','sector','Gerência',
         'title','Aprendizado por comparação',
         'reason','Indicadores e fontes comparados com o snapshot anterior.',
         'action','Propor ajustes de prioridade e cobertura de fontes; alterações de código exigem CI e aprovação.','automated',true)
      ),
     'learning',jsonb_build_object('previousDay',v_prev_day,
       'healthDelta',case when v_previous is null then null
         else a.average_health-coalesce((v_previous->>'averageHealth')::int,a.average_health) end,
       'overdueDelta',case when v_previous is null then null
         else a.overdue_returns-coalesce((v_previous->>'overdueReturns')::int,a.overdue_returns) end,
       'sourceGapDelta',case when v_previous is null then null
         else a.stale_sources-coalesce((v_previous->>'staleSources')::int,a.stale_sources) end,
       'revision','Política operacional v1; inferência sem autotreinamento de pesos ou código')
  ) into v_payload
  from totals a;

  insert into public.hermes_portfolio_diagnostics(empresa_id,day,payload,generated_at,policy_version)
  values(v_company,p_day,coalesce(v_payload,'{}'::jsonb),now(),1)
  on conflict(empresa_id,day) do update set
    payload=excluded.payload,generated_at=now(),policy_version=1;
  v_count:=v_count+1;
 end loop;
 return v_count;
end
$function$;
