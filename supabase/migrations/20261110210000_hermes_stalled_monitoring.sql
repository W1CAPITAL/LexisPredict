-- Hermes: monitoramento judicial separado dos retornos administrativos.
-- Não altera processos, datas de retorno ou histórico de atendimento.
create table if not exists public.hermes_stalled_reviews (
 empresa_id uuid not null,
 processo_id bigint not null references public.processos(id) on delete cascade,
 state text not null default 'scanning'
   check(state in ('scanning','confirmed_idle','no_dated_movement','partial','unavailable','recent_movement')),
 attempted_at timestamptz not null default now(),
 checked_at timestamptz,
 last_movement_at date,
 days_without_movement integer,
 djen_ok boolean not null default false,
 datajud_ok boolean not null default false,
 source_errors jsonb not null default '{}'::jsonb,
 evidence jsonb not null default '[]'::jsonb,
 primary key(empresa_id,processo_id)
);
create index if not exists hermes_stalled_reviews_checked_idx
 on public.hermes_stalled_reviews (empresa_id, checked_at desc);

alter table public.hermes_stalled_reviews enable row level security;
revoke all on public.hermes_stalled_reviews from public, anon, authenticated;
grant select,insert,update,delete on public.hermes_stalled_reviews to service_role;

-- Somente serviço autenticado do Hermes pode reservar uma investigação.
-- Fatos do tribunal e datas de retorno são assuntos diferentes.
create or replace function public.hermes_claim_stalled_review(p_today date)
returns table (empresa_id uuid,processo_id bigint,last_movement_at date)
language sql set search_path = public as $body$
with candidate as (
 select p.id,p.empresa_id,
        greatest(p.ultima_movimentacao,p.datajud_ultimo_movimento::date) as last_court
 from public.processos p
 left join public.hermes_stalled_reviews r
   on r.empresa_id=p.empresa_id and r.processo_id=p.id
 where p.empresa_id is not null
   and p.created_at::date <= p_today-15
   and length(regexp_replace(coalesce(p.protocolo_ref,''),'[^0-9]','','g'))=20
   and upper(concat_ws(' ',p.status_interno,p.status,p.dados->>'situacao'))
       !~ '(ENCERRAD|ARQUIVAD|FINALIZAD|EXTINT|BAIXA DEFINITIVA)'
   and coalesce(greatest(p.ultima_movimentacao,p.datajud_ultimo_movimento::date),
                p.data_distribuicao,p.created_at::date) <= p_today-15
   and (r.processo_id is null
    or (r.state='scanning' and r.attempted_at<now()-interval '8 minutes')
    or (r.state in ('partial','unavailable') and r.attempted_at<now()-interval '24 hours')
    or (r.state in ('confirmed_idle','no_dated_movement','recent_movement')
        and r.checked_at<now()-interval '7 days'))
 order by coalesce(r.checked_at,'1970-01-01'::timestamptz) asc,
          coalesce(p.datajud_consultado_em,'1970-01-01'::timestamptz) asc,
          p.created_at asc,p.id
 limit 1
), claimed as (
 insert into public.hermes_stalled_reviews
   (empresa_id,processo_id,state,attempted_at)
 select c.empresa_id,c.id,'scanning',now() from candidate c
 on conflict (empresa_id,processo_id)
 do update set state='scanning',attempted_at=now()
 where (hermes_stalled_reviews.state='scanning'
        and hermes_stalled_reviews.attempted_at<now()-interval '8 minutes')
    or (hermes_stalled_reviews.state in ('partial','unavailable')
        and hermes_stalled_reviews.attempted_at<now()-interval '24 hours')
    or (hermes_stalled_reviews.state in ('confirmed_idle','no_dated_movement','recent_movement')
        and hermes_stalled_reviews.checked_at<now()-interval '7 days')
 returning hermes_stalled_reviews.empresa_id,hermes_stalled_reviews.processo_id
)
select claimed.empresa_id,claimed.processo_id,c.last_court
from claimed join candidate c on c.id=claimed.processo_id and c.empresa_id=claimed.empresa_id;
$body$;
revoke all on function public.hermes_claim_stalled_review(date) from public,anon,authenticated;
grant execute on function public.hermes_claim_stalled_review(date) to service_role;
