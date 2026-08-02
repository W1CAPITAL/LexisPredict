export async function clearDataJudAuditAction(protocolo: string) {
  const { empresa_id } = await getUserContext();
  if (!empresa_id) return { success: false };

  const admin = await getSupabaseAdmin();
  const { data: dbItem } = await admin
    .from('processos')
    .select('id, dados')
    .eq('protocolo_ref', protocolo)
    .eq('empresa_id', empresa_id)
    .maybeSingle();

  if (!dbItem) return { success: false };

  const patch = {
    tem_atualizacao_pos_retorno: false,
    djen_nova_comunicacao: false,
    tem_novo_andamento: false,
  };

  const updatedDados = { ...(dbItem.dados as any), ...patch };

  const { error } = await admin
    .from('processos')
    .update({ ...patch, dados: updatedDados })
    .eq('id', dbItem.id);

  return { success: !error };
}
