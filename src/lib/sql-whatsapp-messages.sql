-- Tabela de histórico WhatsApp no SUPABASE (não no Postgres da Evolution).
-- Rode no SQL Editor do Supabase uma vez.

CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NULL,
  instance_name text NULL,
  contact_number text NOT NULL,
  contact_name text NULL,
  phone text NULL,
  remote_jid text NULL,
  message_id text NULL,
  message_text text NULL,
  body text NULL,
  from_me boolean DEFAULT false,
  direction text NULL,
  source text NULL,
  timestamp timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  raw_payload jsonb NULL
);

CREATE INDEX IF NOT EXISTS idx_wa_msg_contact ON public.whatsapp_messages (contact_number);
CREATE INDEX IF NOT EXISTS idx_wa_msg_phone ON public.whatsapp_messages (phone);
CREATE INDEX IF NOT EXISTS idx_wa_msg_ts ON public.whatsapp_messages (timestamp);
CREATE INDEX IF NOT EXISTS idx_wa_msg_empresa ON public.whatsapp_messages (empresa_id);

-- Service role (webhook) e usuários autenticados
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wa_messages_select_auth ON public.whatsapp_messages;
CREATE POLICY wa_messages_select_auth ON public.whatsapp_messages
  FOR SELECT TO authenticated
  USING (
    empresa_id IS NULL
    OR empresa_id::text = coalesce(auth.jwt() ->> 'empresa_id', '')
    OR true  -- ajuste depois com claim real; service role bypassa RLS
  );

DROP POLICY IF EXISTS wa_messages_insert_auth ON public.whatsapp_messages;
CREATE POLICY wa_messages_insert_auth ON public.whatsapp_messages
  FOR INSERT TO authenticated
  WITH CHECK (true);

COMMENT ON TABLE public.whatsapp_messages IS 'Histórico Lexis WhatsApp. Evolution grava via webhook; envio do app grava outbound.';
