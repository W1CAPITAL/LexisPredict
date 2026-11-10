-- Histórico operacional: a repetição de uma tarefa ainda aberta do mesmo negócio
-- reaproveita sua linha mais antiga, sem zerar a contagem cumulativa.
-- Nunca consolida entre empresas, negócios diferentes, tarefas concluídas ou ações sem negócio.
alter table public.crm_tarefas
  add column if not exists ocorrencias_total integer not null default 1,
  add column if not exists updated_at timestamptz not null default now();
create index if not exists crm_tarefas_empresa_negocio_abertas_idx
  on public.crm_tarefas (empresa_id, negocio_id, created_at)
  where negocio_id is not null and feito = false;

create or replace function public.crm_consolidate_recurring_task(
  p_id text, p_empresa_id uuid, p_negocio_id text, p_titulo text,
  p_due_at date, p_assignee_id text, p_created_by text
)
returns setof public.crm_tarefas
language plpgsql security invoker set search_path = public
as $function$
declare
  v_task public.crm_tarefas%rowtype;
  v_title text := btrim(regexp_replace(coalesce(p_titulo, ''), '\s+', ' ', 'g'));
  v_client text := nullif(btrim(coalesce(p_negocio_id, '')), '');
begin
  if p_empresa_id is null or nullif(btrim(coalesce(p_id,'')),'') is null or length(v_title) < 3 or length(v_title) > 180 then
    raise exception 'Dados de tarefa inválidos';
  end if;
  -- Interlock apenas entre o mesmo cliente/título da mesma empresa.
  if v_client is not null then
    perform pg_advisory_xact_lock(hashtextextended(p_empresa_id::text || ':' || v_client || ':' || lower(v_title), 0));
    if not exists (select 1 from public.crm_negocios n where n.id = v_client and n.empresa_id = p_empresa_id) then
      raise exception 'Negócio não localizado nesta empresa';
    end if;
    select t.* into v_task from public.crm_tarefas t
    where t.empresa_id = p_empresa_id
      and t.negocio_id = v_client
      and t.feito = false
      and lower(btrim(regexp_replace(t.titulo, '\s+', ' ', 'g'))) = lower(v_title)
    order by t.created_at asc, t.id asc
    limit 1 FOR UPDATE;
    if found then
      update public.crm_tarefas t
      set titulo = v_title, due_at = p_due_at, assignee_id = p_assignee_id,
          ocorrencias_total = coalesce(t.ocorrencias_total, 1) + 1, updated_at = now()
      where t.empresa_id = p_empresa_id and t.id = v_task.id
      returning t.* into v_task;
      return next v_task;
      return;
    end if;
  end if;
  insert into public.crm_tarefas
    (id, empresa_id, negocio_id, titulo, feito, due_at, assignee_id, created_by, created_at, updated_at, ocorrencias_total)
  values (p_id, p_empresa_id, v_client, v_title, false, p_due_at, p_assignee_id, p_created_by, now(), now(), 1)
  returning * into v_task;
  return next v_task;
end
$function$;
revoke all on function public.crm_consolidate_recurring_task(text,uuid,text,text,date,text,text) from public,anon,authenticated;
grant execute on function public.crm_consolidate_recurring_task(text,uuid,text,text,date,text,text) to service_role;
