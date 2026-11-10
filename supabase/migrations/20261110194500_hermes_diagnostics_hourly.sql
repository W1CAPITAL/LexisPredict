-- Lightweight snapshot refreshed every hour during São Paulo business-day coverage.
-- Scheduled in UTC: 10:20–22:20 UTC = 07:20–19:20 São Paulo time.
-- The query stays in Postgres; it does not consume a Vercel function or run local AI.
select cron.schedule('lexis-hermes-deep-diagnostics','20 10-22 * * *',
 'select public.hermes_refresh_portfolio_diagnostics((now() at time zone ''America/Sao_Paulo'')::date);');
