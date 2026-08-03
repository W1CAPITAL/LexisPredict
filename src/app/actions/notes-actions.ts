"use server";

/**
 * Server Actions de Notas — estável (usa server-db).
 * Vínculo cliente/protocolo é opcional (só se as colunas existirem).
 */
import { revalidatePath } from "next/cache";
import {
  getStoredNotes,
  saveSingleNote,
  updateStoredNote,
  deleteStoredNote,
  getUserContext,
  getSupabaseAdmin,
} from "@/lib/server-db";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

function unpackContent(raw: any): { text: string; imageUrl?: string } {
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

function mapNote(r: any) {
  const u = unpackContent(r.content);
  return {
    id: r.id,
    title: r.title || "Nota",
    content: u.text,
    imageUrl: u.imageUrl || null,
    cliente: r.cliente ?? null,
    protocolo: r.protocolo ?? r.protocolo_ref ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    created_at: r.created_at,
    updated_at: r.updated_at,
    created_by: r.created_by,
  };
}

/** Lista todas as notas da empresa — nunca lança para a UI */
export async function getNotesAction() {
  try {
    const rows = await getStoredNotes();
    if (!Array.isArray(rows)) return [];
    return rows.map((r: any) => {
      // getStoredNotes pode já mapear ou devolver row crua
      if (r.content !== undefined && (r.cliente !== undefined || r.title)) {
        return mapNote(r);
      }
      return {
        id: r.id,
        title: r.title || "Nota",
        content: typeof r.content === "string" ? unpackContent(r.content).text : r.content || "",
        imageUrl: r.imageUrl || unpackContent(r.content).imageUrl || null,
        cliente: r.cliente ?? null,
        protocolo: r.protocolo ?? null,
        createdAt: r.createdAt || r.created_at,
        updatedAt: r.updatedAt || r.updated_at,
        created_at: r.created_at,
        updated_at: r.updated_at,
        created_by: r.created_by,
      };
    });
  } catch (e: any) {
    console.error("[getNotesAction]", e?.message || e);
    return [];
  }
}

export async function getNotesByClienteAction(cliente: string) {
  try {
    if (!cliente?.trim()) return [];
    const all = await getNotesAction();
    const c = cliente.trim().toUpperCase();
    return all.filter((n: any) => (n.cliente || "").toUpperCase() === c);
  } catch (e: any) {
    console.error("[getNotesByClienteAction]", e?.message || e);
    return [];
  }
}

export async function getNotesByProtocoloAction(protocolo: string) {
  try {
    if (!protocolo?.trim()) return [];
    const all = await getNotesAction();
    const d = protocolo.replace(/\D/g, "");
    return all.filter((n: any) => {
      const p = String(n.protocolo || "").replace(/\D/g, "");
      return p && p === d;
    });
  } catch {
    return [];
  }
}

export async function createNoteAction(note: {
  title?: string;
  content?: string;
  imageUrl?: string;
  cliente?: string;
  protocolo?: string;
}) {
  try {
    // 1) tenta insert completo (com cliente/protocolo se colunas existirem)
    const { auth_id, empresa_id } = await getUserContext();
    if (!empresa_id || !auth_id || !isSupabaseConfigured || !supabase) {
      return { success: false, error: "Sessão ou Supabase indisponível" };
    }

    const content =
      note.imageUrl
        ? JSON.stringify({ text: note.content || "", imageUrl: note.imageUrl })
        : note.content || "";

    const base: any = {
      title: note.title || "Nota",
      content,
      empresa_id,
      created_by: auth_id,
    };

    // tenta com vínculo cliente
    if (note.cliente || note.protocolo) {
      const withLink = {
        ...base,
        cliente: note.cliente?.trim().toUpperCase() || null,
        protocolo: note.protocolo?.trim() || null,
        protocolo_ref: note.protocolo?.trim() || null,
      };
      const { data, error } = await supabase.from("notes").insert(withLink).select().single();
      if (!error) {
        revalidatePath("/notes");
        return { success: true, data: mapNote(data) };
      }
      // coluna inexistente → cai no insert simples
      console.warn("[createNoteAction] insert com cliente falhou, fallback:", error.message);
    }

    const result = await saveSingleNote({
      title: note.title || "Nota",
      content: note.content || "",
      imageUrl: note.imageUrl,
    });
    if (result.success) revalidatePath("/notes");
    return result;
  } catch (e: any) {
    console.error("[createNoteAction]", e?.message || e);
    return { success: false, error: e?.message || "Falha ao criar nota" };
  }
}

export async function updateNoteAction(
  id: string,
  updates: {
    title?: string;
    content?: string;
    imageUrl?: string;
    cliente?: string;
    protocolo?: string;
  }
) {
  try {
    const result = await updateStoredNote(id, {
      title: updates.title,
      content: updates.content,
      imageUrl: updates.imageUrl,
    });

    // best-effort: atualiza cliente/protocolo se colunas existirem
    if (result.success && (updates.cliente !== undefined || updates.protocolo !== undefined) && supabase) {
      const { empresa_id } = await getUserContext();
      if (empresa_id) {
        const extra: any = { updated_at: new Date().toISOString() };
        if (updates.cliente !== undefined) {
          extra.cliente = updates.cliente?.trim().toUpperCase() || null;
        }
        if (updates.protocolo !== undefined) {
          extra.protocolo = updates.protocolo?.trim() || null;
          extra.protocolo_ref = updates.protocolo?.trim() || null;
        }
        const { error } = await supabase
          .from("notes")
          .update(extra)
          .eq("id", id)
          .eq("empresa_id", empresa_id);
        if (error) console.warn("[updateNoteAction] extra fields:", error.message);
      }
    }

    if (result.success) revalidatePath("/notes");
    return result;
  } catch (e: any) {
    console.error("[updateNoteAction]", e?.message || e);
    return { success: false, error: e?.message || "Falha ao atualizar" };
  }
}

export async function deleteNoteAction(id: string) {
  try {
    const result = await deleteStoredNote(id);
    if (result.success) revalidatePath("/notes");
    return result;
  } catch (e: any) {
    console.error("[deleteNoteAction]", e?.message || e);
    return { success: false, error: e?.message || "Falha ao excluir" };
  }
}
