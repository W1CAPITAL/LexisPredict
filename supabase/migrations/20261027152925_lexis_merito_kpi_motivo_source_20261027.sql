-- Usa o motivo de mérito da coluna dedicada, ignorado pelo índice anterior.
CREATE OR REPLACE FUNCTION public.lexis_merito_categoria_calc(
  p_proc boolean,
  p_dados jsonb,
  p_motivo text
)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $function$
WITH d AS (
  SELECT coalesce(p_dados,'{}'::jsonb) AS j,
         upper(coalesce(nullif(btrim(p_motivo),''),nullif(p_dados->>'procedente_motivo',''),'')) AS motivo
),
f AS (
  SELECT j,motivo,j->>'merito_fonte' AS fonte,
    j->'merito_datajud_20261022'->>'resultado' AS oficial,
    (j->>'evento_tipo'='sentenca_procedente' OR j->>'sentenca_procedente'='true'
      OR lower(coalesce(j->>'merito_resultado',''))='procedente') AS proc,
    (j->>'evento_tipo'='sentenca_improcedente' OR j->>'sentenca_improcedente'='true'
      OR j->>'is_improcedente'='true' OR lower(coalesce(j->>'merito_resultado',''))='improcedente') AS imp,
    (j->>'evento_tipo'='sentenca_parcial' OR j->>'sentenca_parcial'='true'
      OR lower(coalesce(j->>'merito_resultado',''))='parcial') AS parcial,
    CASE
      WHEN motivo ~ '(PROVIMENTO EM PARTE|PARCIALMENTE PROVIDO|^PROVIMENTO$)' THEN NULL
      WHEN motivo ~ '(PARCIAL|EM PARTE)' THEN 'parcial'
      WHEN motivo ~ '(IMPROCEDENTE|IMPROCED[ÊE]NCIA)' THEN 'improcedente'
      WHEN motivo ~ '(PROCEDENTE|PROCED[ÊE]NCIA)'
       AND motivo !~ '(IMPROCEDENTE|PARCIAL|EM PARTE)' THEN 'procedente'
      ELSE NULL
    END AS motivo_categoria
  FROM d
)
SELECT CASE
  WHEN fonte='datajud_tpu_2026-10-22' AND oficial IS NOT NULL THEN
    CASE oficial WHEN 'procedente' THEN 'procedente' WHEN 'improcedente' THEN 'improcedente'
      WHEN 'parcial' THEN 'parcial' WHEN 'conflito_resultados' THEN 'divergente'
      ELSE 'sem_indicador' END
  WHEN (proc AND imp) OR (proc AND parcial) OR (imp AND parcial) THEN 'divergente'
  WHEN motivo_categoria IS NOT NULL AND (
    (motivo_categoria='procedente' AND (imp OR parcial))
    OR (motivo_categoria='improcedente' AND (proc OR parcial))
    OR (motivo_categoria='parcial' AND (proc OR imp))
  ) THEN 'divergente'
  WHEN motivo_categoria IS NOT NULL THEN motivo_categoria
  WHEN parcial THEN 'parcial'
  WHEN imp THEN 'improcedente'
  WHEN proc THEN 'procedente'
  ELSE 'sem_indicador'
END FROM f;
$function$;

-- Compatibilidade para chamadas antigas da função com dois argumentos.
CREATE OR REPLACE FUNCTION public.lexis_merito_categoria_calc(p_proc boolean,p_dados jsonb)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $function$
  SELECT public.lexis_merito_categoria_calc(p_proc,p_dados,p_dados->>'procedente_motivo');
$function$;

CREATE OR REPLACE FUNCTION public.lexis_atualizar_merito_indice()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_categoria text;
  v_categoria_anterior text;
  v_resultado_oficial text;
  v_fonte_oficial text;
BEGIN
  SELECT i.categoria INTO v_categoria_anterior
  FROM public.lexis_merito_indice i
  WHERE i.processo_id=NEW.id AND i.empresa_id=NEW.empresa_id;

  v_categoria := public.lexis_merito_categoria_calc(NEW.is_procedente,NEW.dados,NEW.procedente_motivo);
  v_fonte_oficial := NEW.dados->>'merito_fonte';
  v_resultado_oficial := NEW.dados->'merito_datajud_20261022'->>'resultado';

  IF v_categoria_anterior='divergente' AND v_categoria<>'divergente'
     AND NOT (
       v_fonte_oficial='datajud_tpu_2026-10-22'
       AND v_resultado_oficial IN ('procedente','improcedente','parcial')
     ) THEN
    v_categoria := 'divergente';
  END IF;

  INSERT INTO public.lexis_merito_indice(processo_id,empresa_id,created_by,categoria)
  VALUES(NEW.id,NEW.empresa_id,NEW.created_by,v_categoria)
  ON CONFLICT(processo_id) DO UPDATE SET
    empresa_id=excluded.empresa_id,created_by=excluded.created_by,
    categoria=excluded.categoria,atualizado_em=now()
  WHERE (lexis_merito_indice.empresa_id,lexis_merito_indice.created_by,lexis_merito_indice.categoria)
    IS DISTINCT FROM (excluded.empresa_id,excluded.created_by,excluded.categoria);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_lexis_merito_indice ON public.processos;
CREATE TRIGGER trg_lexis_merito_indice
AFTER INSERT OR UPDATE OF dados,is_procedente,procedente_motivo,created_by,empresa_id
ON public.processos FOR EACH ROW EXECUTE FUNCTION public.lexis_atualizar_merito_indice();

UPDATE public.lexis_merito_indice i
SET categoria=CASE
  WHEN i.categoria='divergente' AND NOT (
    p.dados->>'merito_fonte'='datajud_tpu_2026-10-22'
    AND p.dados->'merito_datajud_20261022'->>'resultado' IN ('procedente','improcedente','parcial')
  ) THEN 'divergente'
  ELSE public.lexis_merito_categoria_calc(p.is_procedente,p.dados,p.procedente_motivo)
END,
atualizado_em=now()
FROM public.processos p
WHERE p.id=i.processo_id AND p.empresa_id=i.empresa_id
AND i.categoria IS DISTINCT FROM CASE
  WHEN i.categoria='divergente' AND NOT (
    p.dados->>'merito_fonte'='datajud_tpu_2026-10-22'
    AND p.dados->'merito_datajud_20261022'->>'resultado' IN ('procedente','improcedente','parcial')
  ) THEN 'divergente'
  ELSE public.lexis_merito_categoria_calc(p.is_procedente,p.dados,p.procedente_motivo)
END;
