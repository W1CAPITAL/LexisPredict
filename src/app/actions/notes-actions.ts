"use server";

/**
 * Server Actions de Notas — com vínculo cliente/protocolo (histórico CRM).
 */
import { revalidatePath } from "next/cache";
import {
  listNotesCrm,
  saveNoteCrm,
  updateNoteCrm,
  deleteNoteCrm,
  type CrmNote,
} from "@/lib/notes/notes-crm";

export async function getNotesAction() {
  return await listNotesCrm();
}

export async function getNotesByClienteAction(cliente: string) {
  return await listNotesCrm({ cliente });
}

export async function getNotesByProtocoloAction(protocolo: string) {
  return await listNotesCrm({ protocolo });
}

export async function createNoteAction(note: Partial<CrmNote> & { title?: string; content?: string }) {
  const result = await saveNoteCrm({
    title: note.title || "Nota",
    content: note.content || "",
    imageUrl: note.imageUrl,
    cliente: note.cliente,
    protocolo: note.protocolo,
  });
  if (result.success) {
    revalidatePath("/notes");
    revalidatePath("/cases");
    revalidatePath("/tarefas");
  }
  return result;
}

export async function updateNoteAction(id: string, updates: Partial<CrmNote>) {
  const result = await updateNoteCrm(id, updates);
  if (result.success) {
    revalidatePath("/notes");
    revalidatePath("/cases");
    revalidatePath("/tarefas");
  }
  return result;
}

export async function deleteNoteAction(id: string) {
  const result = await deleteNoteCrm(id);
  if (result.success) {
    revalidatePath("/notes");
    revalidatePath("/cases");
    revalidatePath("/tarefas");
  }
  return result;
}
