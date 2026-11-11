-- Remove projeções de audiências/sessões que já terminaram.
-- A evidência original permanece em processos.dados / histórico Hermes.
CREATE OR REPLACE FUNCTION public.prune_expired_audiencias(
 p_empresa_id uuid DEFAULT NULL,
 p_now timestamptz DEFAULT now()
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,pg_temp
AS $function$
DECLARE
 local_day date := (p_now AT TIME ZONE 'America/Sao_Paulo')::date;
 local_clock time := (p_now AT TIME ZONE 'America/Sao_Paulo')::time;
 deleted_count integer := 0;
BEGIN
 DELETE FROM public.audiencias_monitoradas
 WHERE (p_empresa_id IS NULL OR empresa_id=p_empresa_id)
   AND (
     COALESCE(data_fim,data_evento)<local_day
     OR (
       COALESCE(data_fim,data_evento)=local_day
       AND CASE
         WHEN trim(COALESCE(hora_fim,'')) ~ '^(?:[01]?[0-9]|2[0-3]):[0-5][0-9]$'
         THEN (
           lpad(split_part(trim(hora_fim),':',1),2,'0')
           || ':' || split_part(trim(hora_fim),':',2)
         )::time <= local_clock
         ELSE false
       END
     )
   );
 GET DIAGNOSTICS deleted_count=ROW_COUNT;
 RETURN deleted_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.prune_expired_audiencias(uuid,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prune_expired_audiencias(uuid,timestamptz) TO service_role;

-- Executa mesmo quando ninguém abre /audiencias; cada chamada só apaga
-- projeções vencidas, nunca processos ou documentos/evidências originais.
DO $schedule$
DECLARE existing_job bigint;
BEGIN
 SELECT jobid INTO existing_job
 FROM cron.job WHERE jobname='lexis-hermes-prune-past-hearings';
 IF existing_job IS NOT NULL THEN
  PERFORM cron.unschedule(existing_job);
 END IF;
 PERFORM cron.schedule(
  'lexis-hermes-prune-past-hearings',
  '*/15 * * * *',
  'select public.prune_expired_audiencias(null, now());'
 );
END;
$schedule$;
