-- A mesma função Vercel do Hermes atende este job. Não aumenta o
-- número de serverless functions no plano Hobby.
-- Executar após publicar a rota com hermesRoute=hearings.
select cron.schedule(
 'lexis-hermes-hearing-monitor',
 '*/10 * * * *',
 $job$
 select net.http_get(
  url := 'https://lexispredict.vercel.app/api/cron/hermes-returns?hermesRoute=hearings',
  headers := jsonb_build_object('Authorization','Bearer ' ||
   (select decrypted_secret from vault.decrypted_secrets
    where name='lexis_wa_daily_cron_token' limit 1)),
  timeout_milliseconds := 50000
 );
 $job$
);
