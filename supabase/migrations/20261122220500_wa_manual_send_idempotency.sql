-- Make user-initiated WA.Auto queueing safe across timeout and retry.
-- Existing automated jobs keep a null client_request_id and are unchanged.

ALTER TABLE public.wa_local_jobs
  ADD COLUMN IF NOT EXISTS client_request_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS wa_local_jobs_client_request_uidx
  ON public.wa_local_jobs (empresa_id, created_by, client_request_id)
  WHERE client_request_id IS NOT NULL;
