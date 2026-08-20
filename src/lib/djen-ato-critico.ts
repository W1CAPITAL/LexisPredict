import { plainTextFromDjen, sortDjenComunicacoesRecentFirst } from '@/lib/djen';

/** Badge "Ato crítico (DJEN dd/mm)" a partir da publicação mais recente. */
export function badgeAtoCriticoDjen(comunicacoes: any[]): {
  label: string;
  texto: string;
  data: string | null;
} | null {
  const ordered = sortDjenComunicacoesRecentFirst(comunicacoes || []);
  const top = ordered[0];
  if (!top) return null;
  const texto = plainTextFromDjen(String(top.texto || top.conteudo || ''));
  if (!texto || texto.length < 30) return null;
  const raw =
    top.data_disponibilizacao ||
    top.dataDisponibilizacao ||
    top.data ||
    '';
  let dataLabel = '';
  const s = String(raw).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m, d] = s.split('-');
    dataLabel = `${d}/${m}`;
  } else if (/^\d{2}\/\d{2}/.test(s)) {
    dataLabel = s.slice(0, 5);
  }
  const U = texto.toUpperCase();
  let kind = 'Publicação DJEN';
  if (/PREPARO|DESER[CÇ]/.test(U) && /GRATUIT|AJG|HIPOSSUFIC/.test(U)) kind = 'AJG / preparo';
  else if (/INTIMA[CÇ]/.test(U)) kind = 'Intimação';
  else if (/SENTEN[CÇ]/.test(U)) kind = 'Sentença';
  else if (/AUDI[EÊ]NCIA/.test(U)) kind = 'Audiência';
  return {
    label: dataLabel ? `Ato crítico (DJEN ${dataLabel}) · ${kind}` : `Ato crítico · ${kind}`,
    texto: texto.slice(0, 500),
    data: dataLabel || null,
  };
}
