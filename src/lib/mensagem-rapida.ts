/**
 * Mensagem rápida ao cliente (sem IA) — Lote 3.
 * Base: linguagem simples + CNJ. Tom leigo e protetivo.
 */
import type { LegalCase } from '@/lib/case-logic';
import { traduzirCaso } from '@/lib/traduzir-andamento';
import { isNovidadeAberta } from '@/lib/novidade';

function primeiroNome(cliente?: string | null): string {
  const t = (cliente || 'Cliente').trim().split(/\s+/)[0] || 'Cliente';
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

export function mensagemRapidaCliente(
  c: LegalCase | null | undefined,
  opts?: { clienteNome?: string; protocolo?: string }
): string {
  if (!c) {
    return [
      `Olá! Tudo bem?`,
      ``,
      `Estamos acompanhando o seu processo. Qualquer novidade objetiva, avisamos por aqui.`,
    ].join('\n');
  }
  const nome = primeiroNome(opts?.clienteNome || c.cliente);
  const cnj = opts?.protocolo || c.protocolo || '';
  const leigo = traduzirCaso(c);
  const detalhe =
    (leigo.detalheLeigo && leigo.detalheLeigo.trim()) ||
    (leigo.tituloLeigo && leigo.tituloLeigo.trim()) ||
    'houve movimentação no tribunal';
  const temNovidade = isNovidadeAberta(c as any);

  if (temNovidade) {
    return [
      `Olá, ${nome}! Tudo bem?`,
      ``,
      `Trazendo uma atualização sobre o processo nº ${cnj}.`,
      ``,
      `${detalhe}`,
      ``,
      `Nossa equipe já está analisando o teor completo. Por enquanto você não precisa fazer nada — assim que tivermos a orientação objetiva, retorno por aqui.`,
      ``,
      `Qualquer dúvida, responda esta mensagem.`,
    ].join('\n');
  }

  return [
    `Olá, ${nome}! Tudo bem?`,
    ``,
    `Seguimos acompanhando o processo nº ${cnj}.`,
    ``,
    `No momento não há novidade crítica após o último contato. Continuamos de olho e avisamos se aparecer algo importante.`,
    ``,
    `Qualquer dúvida, estamos à disposição.`,
  ].join('\n');
}
