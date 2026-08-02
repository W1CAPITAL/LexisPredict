/**
 * @fileOverview Motor de Sincronia e Comparação de Datas DataJud v3.2
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import { startOfDay, parseISO, isAfter, subDays, parse, isValid } from 'date-fns';

export function gerarHashAuditoria(movimentos: any[]): string {
  if (!movimentos || movimentos.length === 0) return "EMPTY";
  
  const sorted = [...movimentos].sort((a, b) => 
    new Date(b.dataHora || 0).getTime() - new Date(a.dataHora || 0).getTime()
  );

  const signature = sorted.slice(0, 3)
    .map(m => `${m.dataHora || ''}|${m.nome || ''}`)
    .join('##');

  try {
    if (typeof btoa !== 'undefined') {
      return btoa(unescape(encodeURIComponent(signature))).substring(0, 32);
    }
    return Buffer.from(signature).toString('base64').substring(0, 32);
  } catch {
    return signature.substring(0, 32);
  }
}

export function detectarEncerradoNoTribunal(movimentos: any[]): {
  encerrado: boolean;
  motivo: string | null;
} {
  if (!movimentos || movimentos.length === 0) {
    return { encerrado: false, motivo: null };
  }

  const sorted = [...movimentos].sort((a, b) => 
    new Date(b.dataHora || 0).getTime() - new Date(a.dataHora || 0).getTime()
  );
  
  const window = sorted.slice(0, 25);

  const patternGroups = [
    {
      patterns: ['BAIXA DEFINITIVA', 'BAIXA DO PROCESSO', 'BAIXA DEFINITIVA DO FEITO', 'PROCESSO BAIXADO', 'DETERMINADA A BAIXA'],
      label: 'BAIXA DEFINITIVA'
    },
    {
      patterns: ['TRÂNSITO EM JULGADO', 'TRANSITO EM JULGADO', 'CERTIFICADA A TRANSITO', 'CERTIFICADO O TRÂNSITO'],
      label: 'TRÂNSITO EM JULGADO'
    },
    {
      patterns: ['EXTINTO O PROCESSO', 'PROCESSO EXTINTO', 'SENTENÇA DE EXTINÇÃO', 'EXTINÇÃO DO PROCESSO', 'JULGO EXTINTO'],
      label: 'EXTINÇÃO DO PROCESSO'
    },
    {
      patterns: ['ARQUIVAMENTO DEFINITIVO', 'ARQUIVADO DEFINITIVAMENTE', 'ARQUIVEM-SE OS AUTOS', 'AUTOS ARQUIVADOS'],
      label: 'ARQUIVAMENTO DEFINITIVO'
    },
    {
      patterns: ['CANCELADA A DISTRIBUIÇÃO', 'CANCELAMENTO DA DISTRIBUIÇÃO', 'DISTRIBUIÇÃO CANCELADA'],
      label: 'CANCELAMENTO DA DISTRIBUIÇÃO'
    }
  ];

  const constructedWindow = window.map(mov => {
    return `${mov.nome || ''} ${mov.complemento || ''} ${mov.descricao || ''}`.toUpperCase();
  });

  for (const group of patternGroups) {
    if (constructedWindow.some(text => group.patterns.some(p => text.includes(p)))) {
      return { encerrado: true, motivo: group.label };
    }
  }

  return { encerrado: false, motivo: null };
}

/**
 * Cumprimento de sentença ATIVO — janela 25 movimentos.
 * Não marca se já houver encerramento definitivo na mesma análise (feito no audit).
 */
export type CumprimentoInstancia = 'G1' | 'G2' | 'desconhecida' | null;

export function detectarCumprimentoSentenca(
  movimentos: any[],
  meta?: { grau?: string | null; classe?: string | null }
): {
  ativo: boolean;
  motivo: string | null;
  instancia: CumprimentoInstancia;
  tipo: 'provisorio' | 'definitivo' | 'generico' | null;
} {
  if (!movimentos || movimentos.length === 0) {
    return { ativo: false, motivo: null, instancia: null, tipo: null };
  }

  const sorted = [...movimentos].sort((a, b) =>
    new Date(b.dataHora || 0).getTime() - new Date(a.dataHora || 0).getTime()
  );

  const window = sorted.slice(0, 40);
  const allText = window
    .map((m) => `${m.nome || ''} ${m.complemento || ''} ${m.descricao || ''}`.toUpperCase())
    .join(' || ');

  const grauRaw = String(meta?.grau || '').toUpperCase();
  const classe = String(meta?.classe || '').toUpperCase();

  // Instância pelo grau do processo ou por palavras nos movimentos
  let instancia: CumprimentoInstancia = null;
  if (
    grauRaw === 'G2' ||
    grauRaw.includes('2') ||
    /SEGUNDO\s*GRAU|2[Aª]?\s*INST|TRIBUNAL\s+DE\s+JUSTI[CÇ]A|C[AÂ]MARA\s+C[IÍ]VEL|AC[OÓ]RD[AÃ]O|RECURSO\s+DE\s+APELA[CÇ][AÃ]O|APELA[CÇ][AÃ]O\s+C[IÍ]VEL/.test(
      allText + ' ' + classe
    )
  ) {
    instancia = 'G2';
  } else if (
    grauRaw === 'G1' ||
    grauRaw.includes('1') ||
    /PRIMEIRO\s*GRAU|1[Aª]?\s*INST|\bVARA\b|JU[IÍ]ZO\s+DE\s+DIREITO/.test(allText + ' ' + classe)
  ) {
    instancia = 'G1';
  } else if (grauRaw) {
    instancia = 'desconhecida';
  }

  // Classe processual já é cumprimento (TPU comum)
  if (/CUMPRIMENTO DE SENTEN[CÇ]A|EXECU[CÇ][AÃ]O DE SENTEN[CÇ]A/.test(classe)) {
    const tipoClasse = /PROVIS[OÓ]RIO/.test(classe) ? 'provisorio' : 'definitivo';
    const labelInst = instancia === 'G2' ? '2ª instância' : instancia === 'G1' ? '1ª instância' : 'instância não informada';
    return {
      ativo: true,
      motivo: `Classe processual: cumprimento/execução de sentença (${labelInst})`,
      instancia: instancia || 'desconhecida',
      tipo: tipoClasse as any,
    };
  }

  const patternsDef = [
    'CUMPRIMENTO DEFINITIVO',
    'CUMPRIMENTO DE SENTENÇA DEFINITIVO',
    'CUMPRIMENTO DE SENTENCA DEFINITIVO',
  ];
  const patternsProv = [
    'CUMPRIMENTO PROVISÓRIO',
    'CUMPRIMENTO PROVISORIO',
    'CUMPRIMENTO PROVISÓRIO DE SENTENÇA',
    'CUMPRIMENTO PROVISORIO DE SENTENCA',
    'EXECUÇÃO PROVISÓRIA',
    'EXECUCAO PROVISORIA',
  ];
  const patternsGen = [
    'CUMPRIMENTO DE SENTENÇA',
    'CUMPRIMENTO DE SENTENCA',
    'FASE DE CUMPRIMENTO',
    'INÍCIO DO CUMPRIMENTO',
    'INICIO DO CUMPRIMENTO',
    'INICIO DO CUMPRIMENTO DE SENTENCA',
    'EXECUÇÃO DE SENTENÇA',
    'EXECUCAO DE SENTENCA',
    'PROCEDIMENTO DE CUMPRIMENTO',
    'REQ. DE CUMPRIMENTO',
    'REQUERIMENTO DE CUMPRIMENTO',
    'PETIÇÃO DE CUMPRIMENTO',
    'PETICAO DE CUMPRIMENTO',
    'CUMPRIMENTO DE ACÓRDÃO',
    'CUMPRIMENTO DE ACORDAO',
    'CUMPRIMENTO DO ACÓRDÃO',
    'LIQUIDAÇÃO DE SENTENÇA',
    'LIQUIDACAO DE SENTENCA',
    'INÍCIO DO CUMPRIMENTO DE SENTENÇA',
    'CUMPRIMENTO DE SENTENÇA NO 2º GRAU',
    'CUMPRIMENTO DE SENTENCA NO 2 GRAU',
    'INÍCIO DA FASE DE CUMPRIMENTO',
    'DISTRIBUIÇÃO DE CUMPRIMENTO',
  ];

  for (const p of patternsDef) {
    if (allText.includes(p)) {
      return {
        ativo: true,
        motivo: `${p}${instancia === 'G2' ? ' (2ª instância)' : instancia === 'G1' ? ' (1ª instância)' : ''}`,
        instancia: instancia || 'desconhecida',
        tipo: 'definitivo',
      };
    }
  }
  for (const p of patternsProv) {
    if (allText.includes(p)) {
      return {
        ativo: true,
        motivo: `${p}${instancia === 'G2' ? ' (2ª instância)' : instancia === 'G1' ? ' (1ª instância)' : ''}`,
        instancia: instancia || 'desconhecida',
        tipo: 'provisorio',
      };
    }
  }
  for (const p of patternsGen) {
    if (allText.includes(p)) {
      return {
        ativo: true,
        motivo: `${p}${instancia === 'G2' ? ' (2ª instância)' : instancia === 'G1' ? ' (1ª instância)' : ''}`,
        instancia: instancia || 'desconhecida',
        tipo: 'generico',
      };
    }
  }

  for (const m of window) {
    const tx = `${m.nome || ''} ${m.complemento || ''} ${m.descricao || ''}`.toUpperCase();
    if (tx.includes('CUMPRIMENTO') && (tx.includes('SENTEN') || tx.includes('EXECU'))) {
      return {
        ativo: true,
        motivo: `CUMPRIMENTO (heurística)${instancia === 'G2' ? ' — 2ª instância' : instancia === 'G1' ? ' — 1ª instância' : ''}`,
        instancia: instancia || 'desconhecida',
        tipo: 'generico',
      };
    }
  }

  return { ativo: false, motivo: null, instancia: null, tipo: null };
}

export function detectarAtualizacaoPosRetorno(
  ultimoRetornoStr: string | null | undefined,
  movimentos: any[]
): { alerta: boolean; dataUltimo: string | null; nomeUltimo: string | null } {
  if (!movimentos || movimentos.length === 0) {
    return { alerta: false, dataUltimo: null, nomeUltimo: null };
  }

  const sorted = [...movimentos].sort((a, b) => 
    new Date(b.dataHora || 0).getTime() - new Date(a.dataHora || 0).getTime()
  );
  
  const lastMov = sorted[0];
  const dataMov = lastMov.dataHora ? parseISO(lastMov.dataHora) : null;
  
  if (!dataMov) return { alerta: false, dataUltimo: null, nomeUltimo: lastMov.nome || null };

  const dataUltimoStr = dataMov.toISOString();
  const nomeUltimo = lastMov.nome || "Movimentação não identificada";

  if (!ultimoRetornoStr || ultimoRetornoStr.trim() === "" || ultimoRetornoStr === "-" || ultimoRetornoStr === "0") {
    const quarentaECincoDias = startOfDay(subDays(new Date(), 45));
    return {
      alerta: isAfter(dataMov, quarentaECincoDias),
      dataUltimo: dataUltimoStr,
      nomeUltimo
    };
  }

  try {
    let dataRetorno;
    const cleanStr = ultimoRetornoStr.trim();
    if (cleanStr.includes('-')) {
      dataRetorno = parseISO(cleanStr);
    } else if (cleanStr.includes('/')) {
      dataRetorno = parse(cleanStr, 'dd/MM/yyyy', new Date());
    }

    if (dataRetorno && isValid(dataRetorno)) {
      const fimDoDiaRetorno = new Date(dataRetorno);
      fimDoDiaRetorno.setHours(23, 59, 59, 999);

      return {
        alerta: isAfter(dataMov, fimDoDiaRetorno),
        dataUltimo: dataUltimoStr,
        nomeUltimo
      };
    }
    return { alerta: false, dataUltimo: dataUltimoStr, nomeUltimo };
  } catch (e) {
    return { alerta: false, dataUltimo: dataUltimoStr, nomeUltimo };
  }
}
