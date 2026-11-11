-- Normaliza a identidade do evento pelo início, preserva o período completo
-- e expira somente após o fim local confirmado no fuso do tribunal.

CREATE OR REPLACE FUNCTION public.audiencia_timezone(p_fuso text, p_tribunal text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_catalog.pg_timezone_names z
      WHERE z.name = NULLIF(btrim(coalesce(p_fuso, '')), '')
    ) THEN btrim(p_fuso)
    WHEN upper(coalesce(p_fuso, '')) LIKE '%BRAS%LIA%' THEN 'America/Sao_Paulo'
    WHEN upper(btrim(coalesce(p_fuso, ''))) IN ('AC', 'ACRE') THEN 'America/Rio_Branco'
    WHEN upper(btrim(coalesce(p_fuso, ''))) = 'AL' THEN 'America/Maceio'
    WHEN upper(btrim(coalesce(p_fuso, ''))) = 'AM' THEN 'America/Manaus'
    WHEN upper(btrim(coalesce(p_fuso, ''))) IN ('AP', 'PA') THEN 'America/Belem'
    WHEN upper(btrim(coalesce(p_fuso, ''))) = 'BA' THEN 'America/Bahia'
    WHEN upper(btrim(coalesce(p_fuso, ''))) IN ('CE', 'MA', 'PB', 'PI', 'RN') THEN 'America/Fortaleza'
    WHEN upper(btrim(coalesce(p_fuso, ''))) IN ('DF', 'ES', 'GO', 'MG', 'PR', 'RJ', 'RS', 'SC', 'SP') THEN 'America/Sao_Paulo'
    WHEN upper(btrim(coalesce(p_fuso, ''))) = 'MS' THEN 'America/Campo_Grande'
    WHEN upper(btrim(coalesce(p_fuso, ''))) = 'MT' THEN 'America/Cuiaba'
    WHEN upper(btrim(coalesce(p_fuso, ''))) = 'PE' THEN 'America/Recife'
    WHEN upper(btrim(coalesce(p_fuso, ''))) = 'RO' THEN 'America/Porto_Velho'
    WHEN upper(btrim(coalesce(p_fuso, ''))) = 'RR' THEN 'America/Boa_Vista'
    WHEN upper(btrim(coalesce(p_fuso, ''))) = 'SE' THEN 'America/Maceio'
    WHEN upper(btrim(coalesce(p_fuso, ''))) = 'TO' THEN 'America/Araguaina'

    WHEN upper(coalesce(p_tribunal, '')) LIKE 'TJAC%' THEN 'America/Rio_Branco'
    WHEN upper(coalesce(p_tribunal, '')) LIKE 'TJAL%' THEN 'America/Maceio'
    WHEN upper(coalesce(p_tribunal, '')) LIKE 'TJAM%' THEN 'America/Manaus'
    WHEN upper(coalesce(p_tribunal, '')) LIKE 'TJAP%' OR upper(coalesce(p_tribunal, '')) LIKE 'TJPA%' THEN 'America/Belem'
    WHEN upper(coalesce(p_tribunal, '')) LIKE 'TJBA%' THEN 'America/Bahia'
    WHEN upper(coalesce(p_tribunal, '')) LIKE 'TJCE%' OR upper(coalesce(p_tribunal, '')) LIKE 'TJMA%'
      OR upper(coalesce(p_tribunal, '')) LIKE 'TJPB%' OR upper(coalesce(p_tribunal, '')) LIKE 'TJPI%'
      OR upper(coalesce(p_tribunal, '')) LIKE 'TJRN%' THEN 'America/Fortaleza'
    WHEN upper(coalesce(p_tribunal, '')) LIKE 'TJPE%' THEN 'America/Recife'
    WHEN upper(coalesce(p_tribunal, '')) LIKE 'TJSE%' THEN 'America/Maceio'
    WHEN upper(coalesce(p_tribunal, '')) LIKE 'TJMS%' THEN 'America/Campo_Grande'
    WHEN upper(coalesce(p_tribunal, '')) LIKE 'TJMT%' THEN 'America/Cuiaba'
    WHEN upper(coalesce(p_tribunal, '')) LIKE 'TJRO%' THEN 'America/Porto_Velho'
    WHEN upper(coalesce(p_tribunal, '')) LIKE 'TJRR%' THEN 'America/Boa_Vista'
    WHEN upper(coalesce(p_tribunal, '')) LIKE 'TJTO%' THEN 'America/Araguaina'
    WHEN upper(coalesce(p_tribunal, '')) LIKE 'TJDF%' OR upper(coalesce(p_tribunal, '')) LIKE 'TJES%'
      OR upper(coalesce(p_tribunal, '')) LIKE 'TJGO%' OR upper(coalesce(p_tribunal, '')) LIKE 'TJMG%'
      OR upper(coalesce(p_tribunal, '')) LIKE 'TJPR%' OR upper(coalesce(p_tribunal, '')) LIKE 'TJRJ%'
      OR upper(coalesce(p_tribunal, '')) LIKE 'TJRS%' OR upper(coalesce(p_tribunal, '')) LIKE 'TJSC%'
      OR upper(coalesce(p_tribunal, '')) LIKE 'TJSP%' THEN 'America/Sao_Paulo'

    WHEN upper(coalesce(p_tribunal, '')) LIKE 'TRT1%' OR upper(coalesce(p_tribunal, '')) LIKE 'TRT2%'
      OR upper(coalesce(p_tribunal, '')) LIKE 'TRT3%' OR upper(coalesce(p_tribunal, '')) LIKE 'TRT4%'
      OR upper(coalesce(p_tribunal, '')) LIKE 'TRT9%' OR upper(coalesce(p_tribunal, '')) LIKE 'TRT10%'
      OR upper(coalesce(p_tribunal, '')) LIKE 'TRT12%' OR upper(coalesce(p_tribunal, '')) LIKE 'TRT15%'
      OR upper(coalesce(p_tribunal, '')) LIKE 'TRT17%' OR upper(coalesce(p_tribunal, '')) LIKE 'TRT18%' THEN 'America/Sao_Paulo'
    WHEN upper(coalesce(p_tribunal, '')) LIKE 'TRT5%' THEN 'America/Bahia'
    WHEN upper(coalesce(p_tribunal, '')) LIKE 'TRT6%' THEN 'America/Recife'
    WHEN upper(coalesce(p_tribunal, '')) LIKE 'TRT7%' OR upper(coalesce(p_tribunal, '')) LIKE 'TRT13%'
      OR upper(coalesce(p_tribunal, '')) LIKE 'TRT16%' OR upper(coalesce(p_tribunal, '')) LIKE 'TRT21%'
      OR upper(coalesce(p_tribunal, '')) LIKE 'TRT22%' THEN 'America/Fortaleza'
    WHEN upper(coalesce(p_tribunal, '')) LIKE 'TRT8%' THEN 'America/Belem'
    WHEN upper(coalesce(p_tribunal, '')) LIKE 'TRT19%' OR upper(coalesce(p_tribunal, '')) LIKE 'TRT20%' THEN 'America/Maceio'
    WHEN upper(coalesce(p_tribunal, '')) LIKE 'TRT23%' THEN 'America/Cuiaba'
    WHEN upper(coalesce(p_tribunal, '')) LIKE 'TRT24%' THEN 'America/Campo_Grande'
    ELSE NULL
  END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.audiencias_monitoradas
    WHERE data_evento IS NOT NULL
    GROUP BY empresa_id, processo_id,
      coalesce(nullif(btrim(tipo), ''), 'audiencia'),
      data_evento,
      coalesce(nullif(btrim(hora_local), ''), '')
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Há audiências duplicadas para a nova chave estável; reconcilie antes de normalizar.';
  END IF;
END;
$$;

UPDATE public.audiencias_monitoradas
SET chave =
  coalesce(nullif(btrim(tipo), ''), 'audiencia') || ':' ||
  to_char(data_evento, 'YYYY-MM-DD') || ':' ||
  coalesce(nullif(btrim(hora_local), ''), '')
WHERE data_evento IS NOT NULL
  AND chave IS DISTINCT FROM (
    coalesce(nullif(btrim(tipo), ''), 'audiencia') || ':' ||
    to_char(data_evento, 'YYYY-MM-DD') || ':' ||
    coalesce(nullif(btrim(hora_local), ''), '')
  );

CREATE OR REPLACE FUNCTION public.normalize_audiencia_chave()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.data_evento IS NOT NULL THEN
    NEW.chave :=
      coalesce(nullif(btrim(NEW.tipo), ''), 'audiencia') || ':' ||
      to_char(NEW.data_evento, 'YYYY-MM-DD') || ':' ||
      coalesce(nullif(btrim(NEW.hora_local), ''), '');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_audiencia_chave ON public.audiencias_monitoradas;
CREATE TRIGGER trg_normalize_audiencia_chave
BEFORE INSERT OR UPDATE OF tipo, data_evento, hora_local, chave
ON public.audiencias_monitoradas
FOR EACH ROW
EXECUTE FUNCTION public.normalize_audiencia_chave();

CREATE OR REPLACE FUNCTION public.prune_expired_audiencias(
  p_empresa_id uuid DEFAULT NULL,
  p_now timestamptz DEFAULT now()
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_deleted integer := 0;
BEGIN
  WITH expired AS (
    SELECT a.id
    FROM public.audiencias_monitoradas a
    CROSS JOIN LATERAL (
      SELECT public.audiencia_timezone(a.fuso, a.tribunal) AS tz
    ) zone
    CROSS JOIN LATERAL (
      SELECT pg_catalog.timezone(zone.tz, p_now) AS local_now
    ) local_clock
    WHERE (p_empresa_id IS NULL OR a.empresa_id = p_empresa_id)
      AND zone.tz IS NOT NULL
      AND coalesce(a.data_fim, a.data_evento) IS NOT NULL
      AND (
        coalesce(a.data_fim, a.data_evento) < local_clock.local_now::date
        OR (
          coalesce(a.data_fim, a.data_evento) = local_clock.local_now::date
          AND CASE
            WHEN nullif(btrim(a.hora_fim::text), '') ~ '^\d{1,2}:\d{2}(:\d{2}(\.\d+)?)?$'
              THEN btrim(a.hora_fim::text)::time < local_clock.local_now::time
            ELSE false
          END
        )
      )
  )
  DELETE FROM public.audiencias_monitoradas a
  USING expired e
  WHERE a.id = e.id;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.audiencia_timezone(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.normalize_audiencia_chave() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prune_expired_audiencias(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_expired_audiencias(uuid, timestamptz) TO service_role;
