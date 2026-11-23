-- Safe expiration: never delete same-day sessions based on an extracted clock.
-- Some legacy extractors copied the session start clock into hora_fim.
CREATE OR REPLACE FUNCTION public.prune_expired_audiencias(
 p_empresa_id uuid DEFAULT NULL,
 p_now timestamptz DEFAULT now()
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp
AS $function$
DECLARE
 deleted_count integer := 0;
BEGIN
 DELETE FROM public.audiencias_monitoradas a
 WHERE (p_empresa_id IS NULL OR a.empresa_id=p_empresa_id)
   AND COALESCE(a.data_fim,a.data_evento) IS NOT NULL
   AND COALESCE(a.data_fim,a.data_evento) <
     (p_now AT TIME ZONE CASE upper(trim(COALESCE(a.fuso,'')))
       WHEN 'MT' THEN 'America/Cuiaba'
       WHEN 'MS' THEN 'America/Campo_Grande'
       WHEN 'AM' THEN 'America/Manaus'
       WHEN 'AC' THEN 'America/Rio_Branco'
       WHEN 'RO' THEN 'America/Porto_Velho'
       WHEN 'RR' THEN 'America/Boa_Vista'
       WHEN 'PA' THEN 'America/Belem'
       WHEN 'AP' THEN 'America/Belem'
       WHEN 'TO' THEN 'America/Araguaina'
       WHEN 'BA' THEN 'America/Bahia'
       WHEN 'PE' THEN 'America/Recife'
       WHEN 'AL' THEN 'America/Maceio'
       WHEN 'SE' THEN 'America/Maceio'
       ELSE 'America/Sao_Paulo'
     END)::date;
 GET DIAGNOSTICS deleted_count=ROW_COUNT;
 RETURN deleted_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.prune_expired_audiencias(uuid,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prune_expired_audiencias(uuid,timestamptz) TO service_role;

-- Keep the existing 15-minute schedule; it now deletes only after the final
-- calendar day in the court's local timezone has elapsed.
DO $schedule$
DECLARE existing_job bigint;
BEGIN
 SELECT jobid INTO existing_job FROM cron.job WHERE jobname='lexis-hermes-prune-past-hearings';
 IF existing_job IS NOT NULL THEN PERFORM cron.unschedule(existing_job); END IF;
 PERFORM cron.schedule(
  'lexis-hermes-prune-past-hearings',
  '*/15 * * * *',
  'select public.prune_expired_audiencias(null, now());'
 );
END;
$schedule$;
