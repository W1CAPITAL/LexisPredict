-- Remove legacy free-model minutes that asserted unsupported judicial facts.
-- Replace with an auditable, current metrics-based administrative summary.
-- Future app minutes are rendered from the latest snapshot and updated when figures change.
update public.hermes_office_daily d
set meeting_note = concat_ws(E'\n',
  'Gerência: Síntese técnica '||d.day::text||'. Processos abertos: '||
     coalesce(d.metrics->>'active','0')||'. Retornos válidos vencidos: '||
     coalesce(d.metrics->>'overdue','0')||'. Datas de retorno inconsistentes: '||
     coalesce(h.payload->>'invalidReturnDates','0')||'.',
  'Supervisão: Consultas judiciais a conferir: '||
     coalesce(h.payload->>'staleSources','0')||'. Revisões com verificação completa: '||
     coalesce(d.metrics->>'readyReviews','0')||'. Revisões incompletas: '||
     coalesce(d.metrics->>'unavailableReviews','0')||'. Fonte indisponível não prova ausência de movimentação.',
  'Processos: Campos de prazo a conferir no tribunal: '||
     coalesce(h.payload->>'registeredDeadlinesDue','0')||
     '. Nenhuma conclusão sobre perda de prazo judicial decorre apenas do cadastro.',
  'Comunicação: Contatos marcados como realizados nos últimos 30 dias: '||
     coalesce(d.metrics->>'contacts30d','0')||'. Rascunhos de mensagens: '||
     coalesce(d.metrics->>'draftMessages','0')||
     '. Nenhuma mensagem enviada nesta síntese.'
),
meeting_engine='auditoria-evidencias-v2',
meeting_status='ready',
meeting_error_code=null,
updated_at=now()
from public.hermes_portfolio_diagnostics h
where h.empresa_id=d.empresa_id and h.day=d.day
  and d.meeting_status='ready'
  and coalesce(d.meeting_engine,'') not like 'auditoria-evidencias-v2%';
