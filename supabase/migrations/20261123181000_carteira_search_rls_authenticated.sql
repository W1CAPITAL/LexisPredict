-- Search RPC is SECURITY INVOKER: processo RLS restricts it to the
-- authenticated caller's own tenant even if p_empresa is spoofed.
-- The function existed but EXECUTE was revoked from authenticated, causing
-- /processos and /tarefas to report "Falha ao consultar a carteira" (42501).
-- No new table privileges, no public access, no RLS bypass.
REVOKE ALL ON FUNCTION public.buscar_carteira_empresa_rapido(uuid,text,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buscar_carteira_empresa_rapido(uuid,text,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.buscar_carteira_empresa_rapido(uuid,text,integer) TO service_role;
