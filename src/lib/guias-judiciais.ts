/**
 * Módulo de Guias Judiciais
 * Gera links diretos + preparação para RPA futuro
 */

const PORTAIS_GUIA: Record<string, (cnj: string) => string> = {
  '26': (cnj) => `https://esaj.tjsp.jus.br/cpopg/open.do`, // TJSP – usuário preenche
  '06': (cnj) => `https://esaj.tjce.jus.br/cpopg/open.do`,
  '02': (cnj) => `https://www2.tjal.jus.br/cpopg/open.do`,
  // Adicione mais tribunais conforme necessário
};

export function getLinkGuiaJudicial(cnj: string): { url: string; tribunal: string; instrucao: string } | null {
  const clean = cnj.replace(/\D/g, '');
  if (clean.length !== 20) return null;

  const tribunalCode = clean.substring(14, 16); // posição TR no CNJ
  const gerador = PORTAIS_GUIA[tribunalCode];

  if (!gerador) {
    return {
      url: 'https://www.cnj.jus.br/',
      tribunal: 'Desconhecido',
      instrucao: 'Tribunal não mapeado. Acesse o portal oficial e busque por “Emissão de Guias”.',
    };
  }

  return {
    url: gerador(cnj),
    tribunal: tribunalCode,
    instrucao: `1. Acesse o link\n2. Cole o número CNJ: ${cnj}\n3. Procure a opção “Emitir Guia” ou “Custas”`,
  };
}
