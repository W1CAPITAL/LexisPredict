/**
 * Persistência de notas vinculadas a cliente/processo (histórico CRM).
 */
"use server";

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

function packContent(content: string, imageUrl?: string | null) {
  if (imageUrl) return JSON.stringify({ text: content, imageUrl });
  return content;
}

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

async function db() {
  const mod = await import("@/lib/server-db");
  const getUserContext = (mod as any).getUserContext;
  const supabase =
    (mod as any).getSupabaseAdmin?.() ||
    (mod as any).supabase ||
    null;
  const ctx = await getUserContext();
  return { ...ctx, supabase };
}

function mapRow(r: any): CrmNote {
  const u = unpackContent(r.content);
  return {
    id: r.id,
    title: r.title || "Nota",
    content: u.text,
    imageUrl: u.imageUrl || null,
    cliente: r.cliente || null,
    protocolo: r.protocolo || r.protocolo_ref || null,
    created_at: r.created_at,
    updated_at: r.updated_at,
    created_by: r.created_by,
  };
}

export async function listNotesCrm(opts?: {
  cliente?: string;
  protocolo?: string;
}): Promise<CrmNote[]> {
  const { empresa_id, auth_id, isMasterView, supabase } = await db();
  if (!empresa_id || !supabase) return [];

  let q = supabase
    .from("notes")
    .select("*")
    .eq("empresa_id", empresa_id)
    .order("created_at", { ascending: false })
    .limit(500);

  if (!isMasterView && auth_id) q = q.eq("created_by", auth_id);
  if (opts?.cliente) q = q.ilike("cliente", opts.cliente.trim());
  if (opts?.protocolo) {
    const digits = opts.protocolo.replace(/\D/g, "");
    q = q.or(`protocolo.eq.${opts.protocolo},protocolo_ref.eq.${opts.protocolo}`);
  }

  const { data, error } = await q;
  if (error) {
    console.error("[notes-crm list]", error.message);
    return [];
  }
  let rows = (data || []).map(mapRow);
  // filtro protocolo por dígitos se necessário
  if (opts?.protocolo) {
    const d = opts.protocolo.replace(/\D/g, "");
    rows = rows.filter(
      (n) =>
        !n.protocolo ||
        String(n.protocolo).replace(/\D/g, "") === d ||
        String(n.protocolo) === opts.protocolo
    );
  }
  if (opts?.cliente) {
    const c = opts.cliente.trim().toUpperCase();
    rows = rows.filter((n) => (n.cliente || "").toUpperCase() === c || !opts.cliente);
    // keep only matching cliente when filtering history
    rows = rows.filter((n) => (n.cliente || "").toUpperCase() === c);
  }
  return rows;
}

export async function saveNoteCrm(note: CrmNote): Promise<{ success: boolean; data?: any; error?: string }> {
  const { empresa_id, auth_id, supabase } = await db();
  if (!empresa_id || !auth_id || !supabase) {
    return { success: false, error: "Sessão inválida" };
  }

  const payload: any = {
    title: note.title || "Nota",
    content: packContent(note.content || "", note.imageUrl),
    empresa_id,
    created_by: auth_id,
    cliente: note.cliente?.trim().toUpperCase() || null,
    protocolo: note.protocolo?.trim() || null,
    protocolo_ref: note.protocolo?.trim() || null,
  };

  const { data, error } = await supabase.from("notes").insert(payload).select().single();
  if (error) return { success: false, error: error.message };
  return { success: true, data: mapRow(data) };
}

export async function updateNoteCrm(
  id: string,
  note: Partial<CrmNote>
): Promise<{ success: boolean; error?: string }> {
  const { empresa_id, supabase } = await db();
  if (!empresa_id || !supabase) return { success: false, error: "Sessão inválida" };

  const dbUpdates: any = { updated_at: new Date().toISOString() };
  if (note.title !== undefined) dbUpdates.title = note.title;
  if (note.content !== undefined || note.imageUrl !== undefined) {
    dbUpdates.content = packContent(note.content || "", note.imageUrl);
  }
  if (note.cliente !== undefined) dbUpdates.cliente = note.cliente?.trim().toUpperCase() || null;
  if (note.protocolo !== undefined) {
    dbUpdates.protocolo = note.protocolo?.trim() || null;
    dbUpdates.protocolo_ref = note.protocolo?.trim() || null;
  }

  const { error } = await supabase
    .from("notes")
    .update(dbUpdates)
    .eq("id", id)
    .eq("empresa_id", empresa_id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function deleteNoteCrm(id: string): Promise<{ success: boolean; error?: string }> {
  const { empresa_id, supabase } = await db();
  if (!empresa_id || !supabase) return { success: false, error: "Sessão inválida" };
  const { error } = await supabase.from("notes").delete().eq("id", id).eq("empresa_id", empresa_id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}
