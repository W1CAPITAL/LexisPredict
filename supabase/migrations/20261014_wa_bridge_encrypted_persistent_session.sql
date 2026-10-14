ALTER TABLE public.wa_local_bridges ADD COLUMN IF NOT EXISTS session_backup text;
COMMENT ON COLUMN public.wa_local_bridges.session_backup IS
 'AES-256-GCM opaque encrypted WhatsApp device state; ciphertext only, encrypted with worker-scoped token, never exposed to browser or user endpoints.';
