/**
 * Enriquecimento multi-tribunal (mesmo fluxo do e-SAJ, para todos os TJs).
 * - Família e-SAJ: tenta enrichWithEsaJAction se existir
 * - Demais: resolve URL pública + metadados do tribunal (consulta manual assistida)
 */
'use server';

import {
  getTribunalByCnj,
  getConsultaUrlForCnj,
  getFallbacksForCnj,
  codigoJusticaFromCnj,
} from '@/lib/tribunais-links';

function digitsCnj(cnj: string) {
  return String(cnj || '').replace(/\D/g, '');
}

export async function enrichMultiTribunalAction(cnjRaw: string) {
  const cnj = cnjRaw.trim();
  const dig = digitsCnj(cnj);
  if (dig.length !== 20) {
    return { success: false, error: 'CNJ inválido (20 dígitos).' };
  }

  const tribunal = getTribunalByCnj(cnj);
  const url = getConsultaUrlForCnj(cnj);
  const fallbacks = getFallbacksForCnj(cnj);
  const code = codigoJusticaFromCnj(cnj);

  if (!tribunal || !url) {
    return {
      success: false,
      error: 'Tribunal não mapeado para este CNJ.',
      code,
    };
  }

  // —— Família e-SAJ: reutiliza ação existente se disponível
  if (tribunal.esajFamily) {
    try {
      const mod = await import('@/app/actions/esa-j-actions');
      if (typeof mod.enrichWithEsaJAction === 'function') {
        const res = await mod.enrichWithEsaJAction(cnj);
        return {
          ...res,
          multi: {
            tribunal: tribunal.sigla,
            nome: tribunal.nome,
            sistema: tribunal.sistema,
            url,
            fallbacks,
            code,
            modo: 'esaj_enrich',
          },
        };
      }
    } catch {
      // segue para modo consulta
    }
  }

  // —— Todos os tribunais: pacote de consulta pública (mesmo “jeito” operacional)
  return {
    success: true,
    note:
      tribunal.esajFamily
        ? 'Tribunal e-SAJ: enrich automático indisponível neste ambiente; use a consulta pública.'
        : `Tribunal ${tribunal.sigla} (${tribunal.sistema}): abra a consulta pública e confira partes/movimentos.`,
    multi: {
      tribunal: tribunal.sigla,
      nome: tribunal.nome,
      sistema: tribunal.sistema,
      url,
      fallbacks,
      code,
      modo: tribunal.esajFamily ? 'esaj_consulta' : 'consulta_publica',
      cnj,
    },
    data: {
      tribunal: {
        sigla: tribunal.sigla,
        nome: tribunal.nome,
        sistema: tribunal.sistema,
        codigo: code,
        urlConsulta: url,
        alternativos: fallbacks,
      },
    },
  };
}

export async function getMultiConsultaUrlAction(cnjRaw: string) {
  const cnj = cnjRaw.trim();
  const url = getConsultaUrlForCnj(cnj);
  const tribunal = getTribunalByCnj(cnj);
  if (!url) return { success: false, url: null as string | null };
  return {
    success: true,
    url,
    tribunal: tribunal?.sigla,
    sistema: tribunal?.sistema,
    fallbacks: getFallbacksForCnj(cnj),
  };
}
