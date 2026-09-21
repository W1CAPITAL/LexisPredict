function g(row: Record<string, any>, ...keys: string[]) {
  const map: Record<string, any> = {};
  for (const [k, v] of Object.entries(row || {})) map[String(k).toLowerCase().trim()] = v;
  for (const k of keys) {
    const v = map[k.toLowerCase()];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return "";
}

export function sheetRowsToLegalCases(rows: any[]) {
  return (rows || []).map((row, i) => {
    const assistente = String(g(row, "Assistente", "CreatedBy", "created_by", "Responsavel", "atendente"));
    const protocolo = String(g(row, "Protocolo", "protocolo_ref", "CNJ", "protocolo"));
    return {
      id: protocolo || `sheet-${i}`,
      protocolo,
      cliente: String(g(row, "Cliente", "cliente")),
      telefone: String(g(row, "Telefone", "telefone")),
      advogado: String(g(row, "Advogado", "advogado")),
      escritorio: String(g(row, "Escritorio", "escritorio")),
      status: String(g(row, "Status", "status") || "Sem Prazo"),
      tribunal: String(g(row, "Tribunal", "tribunal")),
      observacao: String(g(row, "Observacoes", "observacao")),
      ultimoRetorno: String(g(row, "Retorno", "UltimoRetorno", "ultimo_retorno")) || null,
      proximoPrazo: String(g(row, "Proximo_Retorno", "ProximoRetorno", "proximo_retorno")) || null,
      andamento: String(g(row, "Andamento", "andamento")),
      atendente: assistente,
      created_by: assistente,
      situacao: String(g(row, "Situacao_Prazo", "situacao")),
    };
  }).filter((c) => c.protocolo || c.cliente);
}
