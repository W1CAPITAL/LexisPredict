/**
 * Pós-processamento DJEN: "Guia Gerada" / ato ordinatório com guia → custas.
 */
export function classificarDjenCustas(texto: string): {
  isCustas: boolean;
  resumo: string | null;
} {
  const U = (texto || '').toUpperCase();
  if (!U.trim()) return { isCustas: false, resumo: null };
  const hit =
    /GUIA\s+GERADA/.test(U) ||
    /JUNTADA\s*[-–]?\s*GUIA/.test(U) ||
    (/ATO\s+ORDINAT[OÓ]RIO/.test(U) && /GUIA/.test(U)) ||
    (/INTIMA[CÇ][AÃ]O|CI[EÊ]NCIA/.test(U) && /GUIA|CUSTAS|TAXA\s+JUDICI|UFESP/.test(U));
  if (!hit) return { isCustas: false, resumo: null };
  return {
    isCustas: true,
    resumo: 'Custas / guia gerada — não é mera ciência',
  };
}
