-- Hermes: um processo por requisição e verificação a cada dois minutos na jornada.
-- O endpoint limita a execução a um único processo, reduzindo risco de timeout.
-- 11-22 UTC correspondem às 08-19h em São Paulo (sem horário de verão).
-- Reutiliza credencial Vault existente, nunca registra token no Git.
do $schedule$
begin
  if not exists (select 1 from vault.decrypted_secrets where name='lexis_wa_daily_cron_token' and nullif(decrypted_secret,'') is not null) then
    raise exception 'Missing scheduled return cron credential in Vault';
  end if;
  perform cron.schedule('lexis-hermes-due-returns','*/2 11-22 * * *',$cron$
    select net.http_get(
      url := 'https://lexispredict.vercel.app/api/cron/hermes-returns',
      headers := jsonb_build_object('Authorization','Bearer ' ||
        (select decrypted_secret from vault.decrypted_secrets where name='lexis_wa_daily_cron_token' limit 1)),
      timeout_milliseconds := 50000
    );
  $cron$);
end;
$schedule$;
