"use server";

/**
 * Server Actions de Notas — estável (usa server-db).
 * Vínculo cliente/protocolo é opcional (só se as colunas existirem).
 */
import { revalidatePath } from "next/cache";
import {createdByOwnerIds} from "@/lib/carteira-owner-ids";
import {
  getStoredNotes,
  saveSingleNote,
  deleteStoredNote,
  getUserContext,
  getSupabaseAdmin,
} from "@/lib/server-db";


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
    const ctx = await getUserContext();
    const { auth_id, empresa_id } = ctx;
    if (!empresa_id || !auth_id || ctx.isViewer) {
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
      const db=await getSupabaseAdmin();
      const { data, error } = await db.from("notes").insert(withLink).select().single();
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
    const ctx=await getUserContext();
    if(!ctx.auth_id||!ctx.empresa_id||ctx.isViewer||!id)
      return {success:false,error:"Sem permissão para editar esta nota."};
    const db=await getSupabaseAdmin();
    const permitted=()=>{
      let q=db.from('notes').select('id,content').eq('id',id).eq('empresa_id',ctx.empresa_id);
      if(!ctx.isSupervisor&&!ctx.isSuperAdmin)
        q=q.in('created_by',createdByOwnerIds(ctx.auth_id,ctx.profile_id));
      return q;
    };
    const {data:existing,error:lookupError}=await permitted().maybeSingle();
    if(lookupError||!existing)return {success:false,error:"Nota não encontrada ou sem permissão."};
    const patch:Record<string,string|null>={};
    if(updates.title!==undefined)patch.title=updates.title;
    if(updates.cliente!==undefined)patch.cliente=updates.cliente?.trim().toUpperCase()||null;
    if(updates.protocolo!==undefined){
      patch.protocolo=updates.protocolo?.trim()||null;
      patch.protocolo_ref=updates.protocolo?.trim()||null;
    }
    if(updates.content!==undefined||updates.imageUrl!==undefined){
      const existingText=unpackContent(existing.content);
      const text=updates.content!==undefined?updates.content:existingText.text;
      const imageUrl=updates.imageUrl!==undefined?updates.imageUrl:existingText.imageUrl;
      patch.content=imageUrl?JSON.stringify({text,imageUrl}):text;
    }
    if(!Object.keys(patch).length)return {success:false,error:"Nenhuma alteração informada."};
    let q=db.from('notes').update(patch).eq('id',id).eq('empresa_id',ctx.empresa_id);
    if(!ctx.isSupervisor&&!ctx.isSuperAdmin)
      q=q.in('created_by',createdByOwnerIds(ctx.auth_id,ctx.profile_id));
    const {data,error}=await q.select('id').maybeSingle();
    if(error||!data)return {success:false,error:"Não foi possível salvar a nota."};
    revalidatePath("/notes");
    return {success:true};
  }catch(error){
    console.error('[updateNoteAction] failed',error instanceof Error?error.message:'unknown');
    return {success:false,error:"Erro temporário ao atualizar nota."};
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
