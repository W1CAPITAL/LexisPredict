-- =============================================================================
-- LexisPredict — Diagnóstico e recuperação de atendimentos da semana
-- Rode no SQL Editor do Supabase (empresa por empresa se precisar filtrar)
-- =============================================================================

-- 0) Semana corrente (seg–dom) em America/Sao_Paulo
-- Ajuste se quiser outro fuso

-- 1) Quantos processos têm ultimo_retorno NESTA semana (coluna tipada)
SELECT count(*) AS com_retorno_na_semana
FROM public.processos
WHERE ultimo_retorno IS NOT NULL
  AND (ultimo_retorno::date) >= date_trunc('week', (now() AT TIME ZONE 'America/Sao_Paulo')::date)::date
  AND (ultimo_retorno::date) <= ((date_trunc('week', (now() AT TIME ZONE 'America/Sao_Paulo')::date) + interval '6 days')::date);

-- 2) Top atendentes pela coluna atendido_por + ultimo_retorno na semana
SELECT
  coalesce(u.nome, p.atendido_por::text, 'sem-nome') AS atendente,
  count(*) AS atendimentos_semana
FROM public.processos p
LEFT JOIN public.usuarios u ON u.auth_user_id::text = p.atendido_por::text
WHERE p.ultimo_retorno IS NOT NULL
  AND (p.ultimo_retorno::date) >= date_trunc('week', (now() AT TIME ZONE 'America/Sao_Paulo')::date)::date
  AND (p.ultimo_retorno::date) <= ((date_trunc('week', (now() AT TIME ZONE 'America/Sao_Paulo')::date) + interval '6 days')::date)
GROUP BY 1
ORDER BY 2 DESC
LIMIT 10;

-- 3) Logs de atendimento na auditoria (se a tabela existir) — contagem real de eventos
SELECT
  coalesce(user_nome, user_id::text, 'sem-user') AS quem,
  count(*) AS eventos_atendimento
FROM public.auditoria_logs_app
WHERE acao = 'atendimento'
  AND created_at >= date_trunc('week', (now() AT TIME ZONE 'America/Sao_Paulo'))
GROUP BY 1
ORDER BY 2 DESC
LIMIT 10;

-- 4) REPARO: se a coluna ultimo_retorno está vazia mas o JSON dados ainda tem a data
-- (scanner antigo às vezes não tocava a coluna, mas podia sujar o blob — o inverso também)
UPDATE public.processos p
SET ultimo_retorno = (p.dados->>'ultimoRetorno')::date
WHERE (p.ultimo_retorno IS NULL OR p.ultimo_retorno::text IN ('', 'null'))
  AND (p.dados->>'ultimoRetorno') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}';

UPDATE public.processos p
SET ultimo_retorno = to_date(p.dados->>'ultimoRetorno', 'DD/MM/YYYY')
WHERE (p.ultimo_retorno IS NULL OR p.ultimo_retorno::text IN ('', 'null'))
  AND (p.dados->>'ultimoRetorno') ~ '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$';

-- 5) REPARO: restaurar atendido_por a partir do JSON
UPDATE public.processos p
SET atendido_por = nullif(p.dados->>'atendido_por', '')
WHERE (p.atendido_por IS NULL OR p.atendido_por::text = '')
  AND nullif(p.dados->>'atendido_por', '') IS NOT NULL;

-- 6) (Opcional) A partir da auditoria: último atendimento por protocolo nesta semana
-- Descomente se auditoria_logs_app tiver protocolo_ref e created_at
/*
WITH ult AS (
  SELECT DISTINCT ON (protocolo_ref)
    protocolo_ref,
    created_at::date AS dia,
    user_id
  FROM public.auditoria_logs_app
  WHERE acao = 'atendimento'
    AND created_at >= date_trunc('week', (now() AT TIME ZONE 'America/Sao_Paulo'))
  ORDER BY protocolo_ref, created_at DESC
)
UPDATE public.processos p
SET
  ultimo_retorno = ult.dia,
  atendido_por = coalesce(p.atendido_por, ult.user_id::text)
FROM ult
WHERE p.protocolo_ref = ult.protocolo_ref
  AND (p.ultimo_retorno IS NULL OR p.ultimo_retorno < ult.dia);
*/

-- 7) Conferência final
SELECT count(*) AS com_retorno_na_semana_apos_reparo
FROM public.processos
WHERE ultimo_retorno IS NOT NULL
  AND (ultimo_retorno::date) >= date_trunc('week', (now() AT TIME ZONE 'America/Sao_Paulo')::date)::date;
