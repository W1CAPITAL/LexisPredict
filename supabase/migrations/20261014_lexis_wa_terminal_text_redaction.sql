-- Privacidade: manter texto enquanto há envio em andamento; redigir ao finalizar.
CREATE OR REPLACE FUNCTION public.wa_redact_terminal_notice_payload()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NEW.status IN ('sent','cancelled','failed','rejected','uncertain') THEN
    NEW.message := '[Conteúdo descartado após processamento]';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.wa_redact_terminal_notice_payload() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wa_redact_terminal_notice_payload() TO service_role;
CREATE TRIGGER trg_wa_dispatch_privacy_redact
  BEFORE INSERT OR UPDATE OF status ON public.wa_movement_dispatches
  FOR EACH ROW EXECUTE FUNCTION public.wa_redact_terminal_notice_payload();
CREATE TRIGGER trg_wa_daily_privacy_redact
  BEFORE INSERT OR UPDATE OF status ON public.wa_daily_return_sends
  FOR EACH ROW EXECUTE FUNCTION public.wa_redact_terminal_notice_payload();
