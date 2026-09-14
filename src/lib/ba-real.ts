import type { LegalCase } from './case-logic';
import { evidenciaOrdemBa, isClasseBuscaApreensao } from './ba-evidence';

export function isBuscaApreensaoReal(c?: LegalCase | null): boolean {
  if (!c) return false;
  const d = (c as any).dados || {};
  const classe = c.classe_acao || (c as any).classe || (c as any).datajud_classe?.nome || (c as any).datajud_classe || (c as any).classe_processual || d.classe_acao;
  if (!isClasseBuscaApreensao(classe)) return false;
  return Boolean(evidenciaOrdemBa([c.evento_resumo, c.datajud_ultimo_nome, c.djen_ultimo_resumo, c.busca_apreensao_motivo].filter(Boolean).join('\n')));
}

export function temBaCarteiraReal(c: LegalCase, baHits?: Set<string>): boolean {
  if (isBuscaApreensaoReal(c)) return true;
  const proto = String(c.protocolo || '').replace(/\D/g, '');
  // The server index contains verified, exact-CNJ matches only.
  return proto.length === 20 && Boolean(baHits?.has(proto));
}
