/** Pure helper to normalize public corporate party poles returned by DataJud. */
/** Extrai nomes de polo ativo e passivo a partir do array partes do DataJud. */
export function extrairPolos(partes: any[]): { ativo: string[]; passivo: string[]; outros: string[] } {
  const ativo: string[] = [];
  const passivo: string[] = [];
  const outros: string[] = [];
  for (const p of partes || []) {
    const nome = String(
      p?.nome || p?.nomeParte || p?.razaoSocial || p?.nomePessoa || p?.pessoa?.nome || ''
    ).trim();
    if (!nome || nome.length < 3) continue;
    // ignora advogados listados como "parte"
    const tipoParte = String(p?.tipo || p?.tipoParte || p?.qualificacao || '').toUpperCase();
    if (/ADVOGADO|OAB|PROCURADOR|REPRESENTANTE/.test(tipoParte) && !/AUTOR|R[EÉ]U|REQUER/.test(tipoParte)) {
      if (!outros.includes(nome)) outros.push(nome);
      continue;
    }
    const poloRaw = p?.polo ?? p?.tipoPolo ?? p?.codigoPolo ?? p?.poloProcessual ?? '';
    const polo =
      typeof poloRaw === 'object'
        ? String(poloRaw?.codigo || poloRaw?.nome || poloRaw?.descricao || '').toUpperCase()
        : String(poloRaw).toUpperCase();
    if (/ATIVO|^A$|^AT$|AUTOR|REQUERENTE|EXEQUENTE|APELANTE|AGRAVANTE|IMPETRANTE|RECLAMANTE|POLO\s*AT/.test(polo)) {
      if (!ativo.includes(nome)) ativo.push(nome);
    } else if (/PASSIVO|^P$|^PA$|R[EÉ]U|REQUERIDO|EXECUTADO|APELADO|AGRAVADO|IMPETRADO|RECLAMADO|POLO\s*PA/.test(polo)) {
      if (!passivo.includes(nome)) passivo.push(nome);
    } else if (polo.includes('AT') && !polo.includes('PA')) {
      if (!ativo.includes(nome)) ativo.push(nome);
    } else if (polo.includes('PA') || polo === 'P') {
      if (!passivo.includes(nome)) passivo.push(nome);
    } else {
      if (!outros.includes(nome)) outros.push(nome);
    }
  }
  // Se so ha "outros", heuristica: primeiro pessoa fisica ~ ativo, juridica/banco ~ passivo
  if (!ativo.length && !passivo.length && outros.length) {
    const isBank = (n: string) => /BANCO|S\.?A\.?|LTDA|FINANCEIRA|CREDITO|SEGURADORA|CAIXA ECON/.test(n.toUpperCase());
    for (const n of outros) {
      if (isBank(n)) {
        if (!passivo.includes(n)) passivo.push(n);
      } else if (!ativo.includes(n)) {
        ativo.push(n);
      }
    }
  }
  return { ativo, passivo, outros };
}
