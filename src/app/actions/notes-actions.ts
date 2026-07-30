
'use server';

/**
 * @fileOverview Server Actions de Notas v100.0
 * Garante operações atômicas e revalidação de cache.
 */

import { getStoredNotes, saveSingleNote, deleteStoredNote, updateStoredNote } from '@/lib/server-db';
import { CaseNote } from '@/lib/case-logic';
import { revalidatePath } from 'next/cache';

export async function getNotesAction() {
  console.log("[ACTION] [NOTES FETCH]");
  return await getStoredNotes();
}

export async function createNoteAction(note: Partial<CaseNote>) {
  console.log("[ACTION] [NOTE CREATE]", note.title);
  const result = await saveSingleNote(note);
  if (result.success) revalidatePath('/notes');
  return result;
}

export async function updateNoteAction(id: string, updates: Partial<CaseNote>) {
  console.log("[ACTION] [NOTE UPDATE]", id);
  const result = await updateStoredNote(id, updates);
  if (result.success) revalidatePath('/notes');
  return result;
}

export async function deleteNoteAction(id: string) {
  console.log("[ACTION] [NOTE DELETE]", id);
  const result = await deleteStoredNote(id);
  if (result.success) revalidatePath('/notes');
  return result;
}
