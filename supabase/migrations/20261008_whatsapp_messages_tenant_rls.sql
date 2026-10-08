-- LexisPredict: strict tenant access to WhatsApp history.
-- The legacy policy contained "OR true" and exposed messages from other companies.
-- Service-role webhook and outbound persistence continue to operate server-side.
alter table public.whatsapp_messages enable row level security;

drop policy if exists wa_messages_select_auth on public.whatsapp_messages;
create policy wa_messages_select_auth on public.whatsapp_messages
  for select to authenticated
  using (
    empresa_id is not null
    and exists (
      select 1 from public.usuarios u
      where u.auth_user_id = (select auth.uid())
        and u.empresa_id = whatsapp_messages.empresa_id
    )
  );

drop policy if exists wa_messages_insert_auth on public.whatsapp_messages;
create policy wa_messages_insert_auth on public.whatsapp_messages
  for insert to authenticated
  with check (
    empresa_id is not null
    and exists (
      select 1 from public.usuarios u
      where u.auth_user_id = (select auth.uid())
        and u.empresa_id = whatsapp_messages.empresa_id
    )
  );

-- No anonymous access. Existing messages with empresa_id NULL are deliberately
-- not exposed until their tenant can be reliably identified and backfilled.
