-- Killa AI / INFINITUM OAuth read-only boundary for LexisPredict.
-- Ordinary employee JWTs do not contain client_id; their existing workflows are unaffected.
-- All external OAuth JWTs are read-only regardless of the LLM prompt or app JavaScript.
DO $killa_rls$
DECLARE tab record;
BEGIN
 FOR tab IN SELECT n.nspname as schema_name,c.relname as table_name
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relrowsecurity
 LOOP
  EXECUTE format('DROP POLICY IF EXISTS killa_oauth_no_insert ON %I.%I',tab.schema_name,tab.table_name);
  EXECUTE format('CREATE POLICY killa_oauth_no_insert ON %I.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK ((SELECT auth.jwt()->>''client_id'') IS NULL)',tab.schema_name,tab.table_name);
  EXECUTE format('DROP POLICY IF EXISTS killa_oauth_no_update ON %I.%I',tab.schema_name,tab.table_name);
  EXECUTE format('CREATE POLICY killa_oauth_no_update ON %I.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING ((SELECT auth.jwt()->>''client_id'') IS NULL) WITH CHECK ((SELECT auth.jwt()->>''client_id'') IS NULL)',tab.schema_name,tab.table_name);
  EXECUTE format('DROP POLICY IF EXISTS killa_oauth_no_delete ON %I.%I',tab.schema_name,tab.table_name);
  EXECUTE format('CREATE POLICY killa_oauth_no_delete ON %I.%I AS RESTRICTIVE FOR DELETE TO authenticated USING ((SELECT auth.jwt()->>''client_id'') IS NULL)',tab.schema_name,tab.table_name);
  EXECUTE format('REVOKE TRUNCATE ON %I.%I FROM anon, authenticated',tab.schema_name,tab.table_name);
 END LOOP;
END $killa_rls$;

-- Functions with SECURITY DEFINER bypass RLS. Protect the three privileged
-- legal attendance RPCs that are callable by authenticated employees.
-- Preserve the existing trusted logic and signature, injecting an early
-- check against OAuth client_id. Fail the migration if a function changed.
DO $killa_rpc$
DECLARE routine record; original text; guarded text; check_text text;
BEGIN
 check_text := $guard$
 IF nullif(auth.jwt()->>'client_id','') IS NOT NULL THEN
  RAISE EXCEPTION 'OAuth MCP tokens cannot mutate legal records'
   USING ERRCODE='42501';
 END IF;
$guard$;
 FOR routine IN
  SELECT p.oid,p.proname FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.prosecdef=true AND p.proname IN (
   'reserve_office_agent_reply','finalize_office_agent_reply','register_office_agent_return')
 LOOP
  original := pg_get_functiondef(routine.oid);
  IF position('OAuth MCP tokens cannot mutate legal records' IN original)>0 THEN CONTINUE;END IF;
  IF position(E'\nBEGIN\n' IN original)=0 THEN
   RAISE EXCEPTION 'Unexpected function shape for %: review manually before OAuth',routine.proname;
  END IF;
  guarded := replace(original,E'\nBEGIN\n',E'\nBEGIN\n'||check_text);
  EXECUTE guarded;
 END LOOP;
 IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname IN (
   'reserve_office_agent_reply','finalize_office_agent_reply','register_office_agent_return')
   AND position('OAuth MCP tokens cannot mutate legal records' IN pg_get_functiondef(p.oid))>0)<3 THEN
  RAISE EXCEPTION 'Protected legal functions missing, refusing partial OAuth hardening';
 END IF;
END $killa_rpc$;
-- Anonymous clients cannot need these RPCs: each requires auth.uid().
REVOKE EXECUTE ON FUNCTION public.reserve_office_agent_reply(text,text,bigint,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.finalize_office_agent_reply(uuid,text,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.register_office_agent_return(uuid,date) FROM anon;
