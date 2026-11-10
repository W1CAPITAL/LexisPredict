-- Recuperação automática de reunião de IA que falhou, com máximo de três tentativas diárias.
do $schedule$
begin
 if exists(select 1 from cron.job where jobname='lexis-hermes-company-meeting') then
  perform cron.unschedule('lexis-hermes-company-meeting');
 end if;
 if exists(select 1 from vault.decrypted_secrets
   where name='lexis_wa_daily_cron_token' and nullif(decrypted_secret,'') is not null) then
  perform cron.schedule('lexis-hermes-company-meeting','15 14,17,20,21,22 * * *',$cron$
    select net.http_get(
      url:='https://lexispredict.vercel.app/api/cron/hermes-office-meeting',
      headers:=jsonb_build_object('Authorization','Bearer '||
        (select decrypted_secret from vault.decrypted_secrets
        where name='lexis_wa_daily_cron_token' limit 1)),
      timeout_milliseconds:=55000
    );
  $cron$);
 end if;
end
$schedule$;
