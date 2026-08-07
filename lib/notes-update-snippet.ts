/**
 * Substitua updateStoredNote em server-db.ts se o update falhar ao editar.
 */
export const UPDATE_STORED_NOTE_SNIPPET = `
export async function updateStoredNote(id: string, updates: any): Promise<{ success: boolean; error?: string }> {
  const { empresa_id } = await getUserContext();
  if (!empresa_id || !supabase) return { success: false, error: 'Sessão inválida' };
  const dbUpdates: any = { updated_at: new Date().toISOString() };
  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.content !== undefined || updates.imageUrl !== undefined) {
    dbUpdates.content = updates.imageUrl
      ? JSON.stringify({ text: updates.content, imageUrl: updates.imageUrl })
      : updates.content;
  }
  const { error } = await supabase
    .from('notes')
    .update(dbUpdates)
    .eq('id', id)
    .eq('empresa_id', empresa_id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}
`;
