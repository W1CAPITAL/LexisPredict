import {
  createNoteAction,
  updateNoteAction,
  deleteNoteAction,
  getNotesAction,
  getNotesByClienteAction,
} from "@/app/actions/notes-actions";

export const notesService = {
  async getNotes() {
    const result = await getNotesAction();
    return this.dedupeNotes(Array.isArray(result) ? result : []);
  },

  async getByCliente(cliente: string) {
    const result = await getNotesByClienteAction(cliente);
    return this.dedupeNotes(Array.isArray(result) ? result : []);
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
