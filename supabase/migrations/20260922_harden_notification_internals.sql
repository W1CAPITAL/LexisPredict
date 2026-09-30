-- Harden real notification internals and optimize new RLS policies.

revoke all on function public.lexis_notification_enabled(uuid,text) from public, anon, authenticated;
revoke all on function public.lexis_insert_notification(uuid,uuid,text,text,text,text,text,text,bigint,text,jsonb) from public, anon, authenticated;
revoke all on function public.lexis_process_notification_trigger() from public, anon, authenticated;
revoke all on function public.lexis_task_notification_trigger() from public, anon, authenticated;
revoke all on function public.lexis_subscription_notification_trigger() from public, anon, authenticated;

drop policy if exists notificacoes_select_own on public.notificacoes;
create policy notificacoes_select_own on public.notificacoes
  for select to authenticated
  using (
    empresa_id = (select public.current_empresa_id())
    and recipient_user_id = (select auth.uid())
  );

drop policy if exists notificacoes_update_own on public.notificacoes;
create policy notificacoes_update_own on public.notificacoes
  for update to authenticated
  using (
    empresa_id = (select public.current_empresa_id())
    and recipient_user_id = (select auth.uid())
  )
  with check (
    empresa_id = (select public.current_empresa_id())
    and recipient_user_id = (select auth.uid())
  );

drop policy if exists notificacoes_delete_own on public.notificacoes;
create policy notificacoes_delete_own on public.notificacoes
  for delete to authenticated
  using (
    empresa_id = (select public.current_empresa_id())
    and recipient_user_id = (select auth.uid())
  );

drop policy if exists notification_preferences_select_own on public.notification_preferences;
create policy notification_preferences_select_own on public.notification_preferences
  for select to authenticated
  using (
    user_id = (select auth.uid())
    and empresa_id = (select public.current_empresa_id())
  );

drop policy if exists notification_preferences_insert_own on public.notification_preferences;
create policy notification_preferences_insert_own on public.notification_preferences
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and empresa_id = (select public.current_empresa_id())
  );

drop policy if exists notification_preferences_update_own on public.notification_preferences;
create policy notification_preferences_update_own on public.notification_preferences
  for update to authenticated
  using (
    user_id = (select auth.uid())
    and empresa_id = (select public.current_empresa_id())
  )
  with check (
    user_id = (select auth.uid())
    and empresa_id = (select public.current_empresa_id())
  );
