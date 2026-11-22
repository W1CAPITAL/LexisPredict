-- Preserve an evidence-backed state machine for office-agent WhatsApp replies.
-- Existing historical rows are not rewritten by this migration.

ALTER TABLE public.office_agent_reply_events
  ADD CONSTRAINT office_agent_reply_events_accepted_receipt_check
  CHECK (
    status <> 'accepted'
    OR (
      provider_message_id IS NOT NULL
      AND length(btrim(provider_message_id)) BETWEEN 4 AND 128
    )
  ) NOT VALID;

CREATE OR REPLACE FUNCTION public.reserve_office_agent_reply(
  p_jid text,
  p_inbound_message_id text,
  p_processo_id bigint,
  p_reply text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_owner uuid := auth.uid();
  v_company uuid;
  v_received_at timestamptz;
  v_id uuid;
  v_last timestamptz;
  v_total integer;
  v_today integer;
  v_local timestamp;
  v_weekday integer;
  v_existing public.office_agent_reply_events%ROWTYPE;
BEGIN
  IF nullif(auth.jwt()->>'client_id','') IS NOT NULL THEN
    RAISE EXCEPTION 'OAuth MCP tokens cannot mutate legal records'
      USING ERRCODE='42501';
  END IF;
  IF v_owner IS NULL THEN
    RETURN jsonb_build_object('ok',false,'reason','not_authenticated');
  END IF;
  v_company := public.get_user_empresa_id();
  IF v_company IS NULL OR p_jid !~ '^[1-9][0-9]{9,14}@s[.]whatsapp[.]net$'
     OR length(coalesce(p_reply,'')) < 20 OR length(p_reply) > 700
     OR length(coalesce(p_inbound_message_id,'')) < 4 OR length(p_inbound_message_id) > 128
  THEN
    RETURN jsonb_build_object('ok',false,'reason','invalid_details');
  END IF;

  -- Serialize reservations per operator and reconcile a repeated request before
  -- evaluating time-dependent gates. A caller may inspect the existing state,
  -- but ok=false deliberately forbids treating a replay as a new send permit.
  PERFORM pg_advisory_xact_lock(hashtext(v_owner::text),74127);
  SELECT e.* INTO v_existing
  FROM public.office_agent_reply_events e
  WHERE e.owner_id=v_owner AND e.empresa_id=v_company
    AND e.jid=p_jid AND e.inbound_message_id=p_inbound_message_id
  LIMIT 1;
  IF FOUND THEN
    IF v_existing.processo_id <> p_processo_id OR v_existing.reply_excerpt <> p_reply THEN
      RETURN jsonb_build_object(
        'ok',false,
        'reason','duplicate_request_conflict',
        'reservation_id',v_existing.id,
        'status',v_existing.status
      );
    END IF;
    RETURN jsonb_build_object(
      'ok',false,
      'reason','duplicate_request',
      'reservation_id',v_existing.id,
      'status',v_existing.status,
      'has_provider_receipt',nullif(btrim(v_existing.provider_message_id),'') IS NOT NULL
    );
  END IF;

  v_local := now() AT TIME ZONE 'America/Sao_Paulo';
  v_weekday := extract(isodow FROM v_local);
  IF v_weekday > 5 OR v_local::time < time '09:00' OR v_local::time >= time '17:00' THEN
    RETURN jsonb_build_object('ok',false,'reason','outside_service_window');
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.office_agent_reply_grants g
    WHERE g.owner_id=v_owner AND g.empresa_id=v_company AND g.jid=p_jid
      AND g.processo_id=p_processo_id AND g.revoked_at IS NULL AND g.expires_at>now()
  ) THEN
    RETURN jsonb_build_object('ok',false,'reason','contact_not_authorized');
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.processos p
    WHERE p.id=p_processo_id AND p.empresa_id=v_company
      AND p.datajud_last_ok=true AND p.datajud_consultado_em>now()-interval '7 days'
      AND p.datajud_consultado_em<=now()+interval '5 minutes'
      AND p.datajud_ultimo_nome IS NOT NULL
  ) THEN
    RETURN jsonb_build_object('ok',false,'reason','official_evidence_unverified');
  END IF;
  SELECT m.timestamp INTO v_received_at
  FROM public.office_wa_message_archive m
  WHERE m.owner_id=v_owner AND m.empresa_id=v_company AND m.jid=p_jid
    AND m.provider_message_id=p_inbound_message_id AND m.is_from_me=false
    AND m.timestamp>now()-interval '24 hours' AND m.timestamp<=now()+interval '5 minutes'
  LIMIT 1;
  IF v_received_at IS NULL THEN
    RETURN jsonb_build_object('ok',false,'reason','missing_recent_inbound');
  END IF;
  IF EXISTS(
    SELECT 1 FROM public.office_wa_message_archive m
    WHERE m.owner_id=v_owner AND m.empresa_id=v_company AND m.jid=p_jid
      AND m.is_from_me=true AND m.timestamp>=v_received_at
  ) THEN
    RETURN jsonb_build_object('ok',false,'reason','human_already_replied');
  END IF;
  SELECT count(*),max(created_at) INTO v_total,v_last
  FROM public.office_agent_reply_events e
  WHERE e.owner_id=v_owner AND e.created_at>=now()-interval '20 minutes';
  IF v_total>0 THEN
    RETURN jsonb_build_object('ok',false,'reason','global_cooldown');
  END IF;
  SELECT count(*) INTO v_today
  FROM public.office_agent_reply_events e
  WHERE e.owner_id=v_owner
    AND (e.created_at AT TIME ZONE 'America/Sao_Paulo')::date=v_local::date;
  IF v_today>=10 THEN
    RETURN jsonb_build_object('ok',false,'reason','daily_volume_limit');
  END IF;
  IF EXISTS(
    SELECT 1 FROM public.office_agent_reply_events e
    WHERE e.owner_id=v_owner AND e.jid=p_jid
      AND (e.created_at AT TIME ZONE 'America/Sao_Paulo')::date=v_local::date
  ) THEN
    RETURN jsonb_build_object('ok',false,'reason','contact_daily_limit');
  END IF;
  INSERT INTO public.office_agent_reply_events(
    owner_id,empresa_id,jid,processo_id,inbound_message_id,reply_excerpt
  ) VALUES(v_owner,v_company,p_jid,p_processo_id,p_inbound_message_id,p_reply)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok',true,'reservation_id',v_id,'reason','reserved');
END
$function$;

CREATE OR REPLACE FUNCTION public.finalize_office_agent_reply(
  p_id uuid,
  p_status text,
  p_provider_message_id text DEFAULT NULL::text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_provider_message_id text := nullif(btrim(left(coalesce(p_provider_message_id,''),128)),'');
BEGIN
  IF nullif(auth.jwt()->>'client_id','') IS NOT NULL THEN
    RAISE EXCEPTION 'OAuth MCP tokens cannot mutate legal records'
      USING ERRCODE='42501';
  END IF;
  IF auth.uid() IS NULL OR p_status NOT IN ('accepted','uncertain') THEN
    RETURN false;
  END IF;
  -- Accepted is evidence-bearing: without the provider receipt, callers must
  -- finalize as uncertain and must not update the process return ledger.
  IF p_status='accepted'
     AND (v_provider_message_id IS NULL OR length(v_provider_message_id)<4) THEN
    RETURN false;
  END IF;
  UPDATE public.office_agent_reply_events e
  SET status=p_status,
      provider_message_id=v_provider_message_id,
      updated_at=now()
  WHERE e.id=p_id AND e.owner_id=auth.uid()
    AND e.empresa_id=public.get_user_empresa_id()
    AND e.status='reserved';
  RETURN FOUND;
END
$function$;

REVOKE EXECUTE ON FUNCTION public.reserve_office_agent_reply(text,text,bigint,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.finalize_office_agent_reply(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_office_agent_reply(text,text,bigint,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finalize_office_agent_reply(uuid,text,text) TO authenticated, service_role;
