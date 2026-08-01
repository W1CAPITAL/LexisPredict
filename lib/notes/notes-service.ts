
import { CaseNote } from "@/lib/case-logic";
import { createNoteAction, updateNoteAction, deleteNoteAction, getNotesAction } from "@/app/actions/notes-actions";

/**
 * @fileOverview Serviço de Gestão de Notas v100.0
 * Centraliza lógica de deduplicação e acesso a dados.
 */

export const notesService = {
  async getNotes(): Promise<CaseNote[]> {
    const result = await getNotesAction();
    return this.dedupeNotes(result);
  },

  async createNote(note: Partial<CaseNote>): Promise<{ success: boolean; data?: any }> {
    return await createNoteAction(note);
  },

  async updateNote(id: string, updates: Partial<CaseNote>): Promise<{ success: boolean }> {
    return await updateNoteAction(id, updates);
  },

  async deleteNote(id: string): Promise<{ success: boolean }> {
    return await deleteNoteAction(id);
  },

  /**
   * Remove duplicatas garantindo integridade de renderização.
   */
  dedupeNotes(notes: CaseNote[]): CaseNote[] {
    const map = new Map<string, CaseNote>();
    notes.forEach(n => {
      if (n.id) map.set(n.id, n);
    });
    return Array.from(map.values()).sort((a, b) => {
      // Ordenação por data (assumindo formato DD/MM/YYYY, HH:mm:ss ou ISO)
      return b.id.localeCompare(a.id); // Fallback por ID se datas falharem
    });
  }
};
