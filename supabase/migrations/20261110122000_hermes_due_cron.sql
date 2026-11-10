-- Always-on return reviews, independently of browser sessions and WhatsApp.
-- Schedule daily 08:00–19:55 São Paulo (11:00–22:55 UTC), 2 cases / 5 min.
-- Reads EXISTING Vault secret by name; no token is committed to the repository.
-- The authorization token is used only for server-to-server traffic.
do $schedule$
begin
  if not exists (select 1 from cron.job where jobname = 'lexis-hermes-due-returns') then
    perform cron.schedule('lexis-hermes-due-returns', '*/5 11-22 * * *', $cron$
      select net.http_get(
        url := 'https://lexispredict.vercel.app/api/cron/hermes-returns',
        headers := jsonb_build_object(
          'Authorization',
          'Bearer ' || (select ds.decrypted_secret
                       from vault.decrypted_secrets ds
                       where ds.name = 'lexis_wa_daily_cron_token' limit 1)
        ),
        timeout_milliseconds := 50000
      );
    $cron$);
  end if;
end;
$schedule$;
