-- Non-destructive QR freshness and on-demand re-pairing command protocol.
-- Applied to lexipredict Supabase on 2026-10-16.
ALTER TABLE public.wa_local_bridges
  ADD COLUMN IF NOT EXISTS qr_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS qr_refresh_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS qr_refresh_handled_at timestamptz;
COMMENT ON COLUMN public.wa_local_bridges.qr_generated_at IS
  'Actual QR issuance time from linked-device worker, not heartbeat time';
