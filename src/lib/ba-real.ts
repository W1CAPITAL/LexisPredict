import type { LegalCase } from "@/lib/case-logic";

function norm(s: unknown): string {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

const CLASSE_BA = /BUSCA E APREENS/;
const MANDADO_REAL =
  /MANDADO DE BUSCA|LIMINAR DE BUSCA|APREENSAO DEFERIDA|APREENSÃO DEFERIDA|CUMPRA[- ]SE O MANDADO|DEFERIDA A LIMINAR DE BUSCA|BUSCA E APREENSAO CONTRA/;
const JURISPRUDENCIA =
  /NESSE SENTIDO|CONFORME JULGADO|JURISPRUDENCIA|NO MESMO SENTIDO|CITANDO|EXEMPLIFICATIVAMENTE|PRECEDENTE/;

/** B.A. de verdade: classe do processo + ato de mandado/liminar. Palavra solta não conta. */
export function isBuscaApreensaoReal(c?: LegalCase | null): boolean {
  if (!c) return false;
  const classe = norm(
    (c as any).classe ||
      (c as any).datajud_classe ||
      (c as any).classe_processual ||
      (c as any).assunto
  );
  const tipo = String((c as any).ba_tipo || "");
  const txt = norm(
    [
      c.evento_resumo,
      (c as any).datajud_ultimo_nome,
      (c as any).djen_ultimo_resumo,
    ].join(" ")
  );

  if (JURISPRUDENCIA.test(txt) && !MANDADO_REAL.test(txt)) return false;

  const classeOk = CLASSE_BA.test(classe);
  const mandadoOk = MANDADO_REAL.test(txt) || /mandado|liminar_deferida/i.test(tipo);
  if (classeOk && mandadoOk) return true;
  if (classeOk && tipo.length > 2) return true;
  return false;
}

export function temBaCarteiraReal(c: LegalCase, baHits?: Set<string>): boolean {
  if (isBuscaApreensaoReal(c)) return true;
  const proto = String(c.protocolo || "").replace(/\D/g, "");
  if (baHits && proto && baHits.has(proto)) return true;
  return false;
}
