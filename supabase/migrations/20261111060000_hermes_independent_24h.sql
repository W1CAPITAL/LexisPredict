-- Hermes automatico 24/7, sem uma fila bloquear a outra.
-- ALTERA somente a agenda; nao muda processos, contatos ou dados juridicos.
-- Cron usa UTC; "* * * * *" inclui todas as horas, inclusive madrugada do Brasil.
-- O mesmo segredo autorizado do cron anterior permanece no Vault.
select cron.alter_job(
 job_id := (select jobid from cron.job where jobname='lexis-hermes-due-returns'),
 schedule := '*/5 * * * *'
);

-- Usa a MESMA funcao serverless do Hermes com modo privado autenticado.
-- A fila de processos parados e independente, com lock tenant/processo no Supabase.
select cron.schedule(
 'lexis-hermes-stalled-monitor',
 '2-59/5 * * * *',
 $hermes_stalled$
 select net.http_get(
  url := 'https://lexispredict.vercel.app/api/cron/hermes-returns?hermesRoute=stalled',
  headers := jsonb_build_object('Authorization','Bearer ' ||
    (select decrypted_secret from vault.decrypted_secrets
     where name='lexis_wa_daily_cron_token' limit 1)),
  timeout_milliseconds := 50000
 );
 $hermes_stalled$
);
