-- Reunião consolidada automática uma vez por dia, no servidor (sem IA local).
-- Usa a mesma credencial segura já cadastrada no Vault para os crons Lexis.
do $schedule$
begin
 if exists (select 1 from vault.decrypted_secrets where name='lexis_wa_daily_cron_token'
   and nullif(decrypted_secret,'') is not null)
 and not exists (select 1 from cron.job where jobname='lexis-hermes-company-meeting') then
   perform cron.schedule('lexis-hermes-company-meeting','15 21 * * *',$cron$
     select net.http_get(
       url := 'https://lexispredict.vercel.app/api/cron/hermes-office-meeting',
       headers := jsonb_build_object('Authorization',
         'Bearer '||(select decrypted_secret from vault.decrypted_secrets
                     where name='lexis_wa_daily_cron_token' limit 1)),
       timeout_milliseconds := 55000
     );
   $cron$);
 end if;
end
$schedule$;
