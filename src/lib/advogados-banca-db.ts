"use server";

/**
 * Persistência da banca — campos completos para procuração.
 */
export async function upsertAdvogadoBancaCompleto(adv: Record<string, any>) {
  const mod = await import("@/lib/server-db");
  const getUserContext = (mod as any).getUserContext;
  const supabase =
    (mod as any).getSupabaseAdmin?.() ||
    (mod as any).supabase ||
    null;
  const { empresa_id } = await getUserContext();
  if (!empresa_id || !supabase) return { success: false, error: "Sessão expirada" };

  const payload: Record<string, any> = {
    empresa_id,
    ativo: adv.ativo ?? true,
    nome: adv.nome,
    genero: adv.genero ?? null,
    nacionalidade: adv.nacionalidade ?? null,
    estado_civil: adv.estado_civil ?? adv.estadoCivil ?? null,
    cpf: adv.cpf ?? null,
    rg: adv.rg ?? null,
    endereco: adv.endereco ?? null,
    cidade: adv.cidade ?? null,
    uf: adv.uf ?? null,
    cep: adv.cep ?? null,
    email: adv.email ?? null,
    email_profissional: adv.email_profissional ?? adv.emailProfissional ?? null,
    telefone: adv.telefone ?? null,
    celular: adv.celular ?? null,
    site: adv.site ?? null,
    observacao: adv.observacao ?? null,
    oabs: adv.oabs ?? {},
  };
  if (adv.id) payload.id = adv.id;

  const { data, error } = await supabase
    .from("advogados_banca")
    .upsert(payload, { onConflict: "id" })
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}
