/**
 * Scripts passivos WhatsApp — cumprimento / honorários (Provimento OAB).
 * Sem R$, sem promessa de depósito, só cliente da carteira.
 */

export function scriptWhatsAppAposTeor(opts: {
  nome: string;
  protocolo: string;
  tipo?: string | null;
  art523?: boolean;
  encontroContas?: boolean;
  jaEmCumprimento?: boolean;
}): string {
  const nome = (opts.nome || 'Cliente').split(' ')[0];
  const cnj = opts.protocolo || '';
  if (opts.jaEmCumprimento) {
    return [
      `Olá, ${nome}! Tudo bem?`,
      ``,
      `Sobre o processo nº ${cnj}, o tribunal já registra fase de cumprimento de sentença.`,
      `Nossa equipe está acompanhando os atos dessa fase e te orienta com segurança sobre o que for necessário do seu lado.`,
      ``,
      `Qualquer novidade objetiva, avisamos por aqui.`,
    ].join('\n');
  }
  if (opts.encontroContas) {
    return [
      `Olá, ${nome}! Tudo bem?`,
      ``,
      `Atualizando o processo nº ${cnj}: há menção a encontro de contas / compensação no teor.`,
      `Isso pode influenciar o valor líquido — estamos conferindo com cuidado antes de qualquer orientação de cobrança ou depósito.`,
      ``,
      `Assim que tivermos a leitura fechada, retornamos.`,
    ].join('\n');
  }
  if (opts.art523 || opts.tipo === 'sucumbencia' || opts.tipo === 'ambos') {
    return [
      `Olá, ${nome}! Tudo bem?`,
      ``,
      `Identificamos andamentos que podem autorizar a fase de cumprimento no processo nº ${cnj}.`,
      `Nossa equipe jurídica está validando o teor completo (incluindo honorários e prazos) antes de qualquer protocolo.`,
      ``,
      `Você não precisa fazer nada neste momento. Qualquer passo necessário, explicamos em linguagem simples por aqui.`,
    ].join('\n');
  }
  return [
    `Olá, ${nome}! Tudo bem?`,
    ``,
    `Estamos revisando o teor mais recente do processo nº ${cnj} para ver se há título útil para cumprimento.`,
    `Assim que a análise estiver fechada, te retorno com a orientação objetiva.`,
  ].join('\n');
}
