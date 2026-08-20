export function sanitizePecaTexto(text: string, opts?: { includeBanco?: boolean }): string {
  let t = String(text || "");
  if (opts?.includeBanco === false) {
    t = t.replace(/,\s*promovida contra[^.,]*/gi, "");
    t = t.replace(/,\s*em face de[^.,]*/gi, "");
    t = t.replace(/,\s*envolvendo[^.,]*/gi, "");
    t = t.replace(/,\s*inscrit[oa] no CNPJ[^.,]*/gi, "");
  }
  t = t.replace(/\[(BANCO|CNPJ|CREDOR|INSTITUIÇÃO|INSTITUICAO)[^\]]*\]/gi, "");
  return t.replace(/\s{2,}/g, " ").replace(/\s+\./g, ".").trim();
}
