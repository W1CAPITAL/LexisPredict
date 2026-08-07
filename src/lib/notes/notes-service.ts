import {
  createNoteAction,
  updateNoteAction,
  deleteNoteAction,
  getNotesAction,
  getNotesByClienteAction,
} from "@/app/actions/notes-actions";

export const notesService = {
  async getNotes() {
    try {
      const result = await getNotesAction();
      return this.dedupeNotes(Array.isArray(result) ? result : []);
    } catch (e) {
      console.error("[notesService.getNotes]", e);
      return [];
    }
  },

  async getByCliente(cliente: string) {
    try {
      const result = await getNotesByClienteAction(cliente);
      return this.dedupeNotes(Array.isArray(result) ? result : []);
    } catch {
      return [];
    }
  },

  async createNote(note: {
    title?: string;
    content?: string;
    imageUrl?: string;
    cliente?: string;
    protocolo?: string;
  }) {
    return await createNoteAction(note);
  },

  async updateNote(id: string, updates: any) {
    return await updateNoteAction(id, updates);
  },

  async deleteNote(id: string) {
    return await deleteNoteAction(id);
  },

  dedupeNotes(notes: any[]) {
    const map = new Map<string, any>();
    notes.forEach((n) => {
      if (n?.id) map.set(n.id, n);
    });
    return Array.from(map.values());
  },
};
