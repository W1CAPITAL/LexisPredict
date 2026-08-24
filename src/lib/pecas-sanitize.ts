/**
 * Limpa o texto da peça SEM destruir quebras de linha (layout do PDF depende disso).
 */
export function sanitizePecaTexto(text: string, opts?: { includeBanco?: boolean }): string {
  let t = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  if (opts?.includeBanco === false) {
    t = t.replace(/,\s*promovida contra[^.,\n]*/gi, "");
    t = t.replace(/,\s*em face de[^.,\n]*/gi, "");
    t = t.replace(/,\s*envolvendo[^.,\n]*/gi, "");
    t = t.replace(/,\s*inscrit[oa] no CNPJ[^.,\n]*/gi, "");
    t = t.replace(/,\s*mantido junto a[^.,\n]*/gi, "");
  }

  t = t.replace(/\[(BANCO|CNPJ|CREDOR|INSTITUIÇÃO|INSTITUICAO)[^\]]*\]/gi, "");

  t = t
    .split("\n")
    .map((line) =>
      line
        .replace(/[ \t]{2,}/g, " ")
        .replace(/\s+\./g, ".")
        .replace(/[ \t]+$/g, "")
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return t;
}
