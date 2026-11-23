-- Move apenas o monitor de carteira; os demais crons permanecem intactos.
-- Execucao regional sao-paulo evita bloqueios geograficos do DJEN.
DO $job$
DECLARE job_id bigint;
BEGIN
  SELECT jobid INTO job_id FROM cron.job
    WHERE jobname='lexis-hermes-full-portfolio' AND active;
  IF job_id IS NULL THEN
    RAISE EXCEPTION 'Existing Hermes portfolio cron not found';
  END IF;
  PERFORM cron.alter_job(
    job_id := job_id,
    schedule := '*/2 * * * *',
    command := $cron$
      SELECT net.http_post(
        url := 'https://segjskjlbeydlljnefai.supabase.co/functions/v1/hermes-background?forceFunctionRegion=sa-east-1',
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'x-region','sa-east-1',
          'Authorization','Bearer ' ||
          (SELECT decrypted_secret FROM vault.decrypted_secrets
            WHERE name='lexis_wa_daily_cron_token' LIMIT 1)
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 55000
      );
    $cron$
  );
END $job$;