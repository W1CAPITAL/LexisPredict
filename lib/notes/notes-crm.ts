/**
 * Helpers de nota (sem "use server").
 * Persistência real está em notes-actions + server-db.
 */

export type CrmNote = {
  id?: string;
  title: string;
  content: string;
  imageUrl?: string | null;
  cliente?: string | null;
  protocolo?: string | null;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
};

export function unpackContent(raw: any): { text: string; imageUrl?: string } {
  if (!raw) return { text: "" };
  if (typeof raw === "object") {
    return { text: String(raw.text || raw.content || ""), imageUrl: raw.imageUrl };
  }
  const s = String(raw);
  if (s.trim().startsWith("{")) {
    try {
      const j = JSON.parse(s);
      return { text: String(j.text || j.content || s), imageUrl: j.imageUrl };
    } catch {
      /* */
    }
  }
  return { text: s };
}

/** @deprecated use getNotesAction */
export async function listNotesCrm() {
  const { getNotesAction } = await import("@/app/actions/notes-actions");
  return getNotesAction();
}

export async function saveNoteCrm(note: CrmNote) {
  const { createNoteAction } = await import("@/app/actions/notes-actions");
  return createNoteAction({
    title: note.title,
    content: note.content,
    imageUrl: note.imageUrl ?? undefined,
    cliente: note.cliente ?? undefined,
    protocolo: note.protocolo ?? undefined,
  });
}

export async function updateNoteCrm(id: string, note: Partial<CrmNote>) {
  const { updateNoteAction } = await import("@/app/actions/notes-actions");
  return updateNoteAction(id, {
    title: note.title,
    content: note.content,
    imageUrl: note.imageUrl ?? undefined,
    cliente: note.cliente ?? undefined,
    protocolo: note.protocolo ?? undefined,
  });
}

export async function deleteNoteCrm(id: string) {
  const { deleteNoteAction } = await import("@/app/actions/notes-actions");
  return deleteNoteAction(id);
}
