-- Accelerate the cross-company queue poll used by the authenticated cron worker.
-- The existing tenant-first indexes cannot serve this global lookup:
--   status IN ('pending','processing') AND attempts < 3 ORDER BY id LIMIT 1.
-- INCLUDE keeps the selected empresa_id in the index and avoids reading queue rows.
CREATE INDEX IF NOT EXISTS wa_portfolio_scan_global_poll_idx
  ON public.wa_portfolio_scan_queue (id)
  INCLUDE (empresa_id)
  WHERE attempts < 3
    AND status IN ('pending', 'processing');

COMMENT ON INDEX public.wa_portfolio_scan_global_poll_idx IS
  'Covers the global cron poll for a pending tenant without exposing queue payloads.';
