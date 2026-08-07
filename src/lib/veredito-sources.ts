/**
 * Resolução de fontes para Veredito: DataJud primeiro; se vazio/erro → DJEN.
 * Movimentos DJEN são normalizados para o mesmo shape de timeline.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import { fetchDataJud } from '@/lib/datajud';
import { fetchDjenComunicacoes } from '@/lib/djen';

export type VereditoMovimento = {
  nome?: string;
  complemento?: string;
  descricao?: string;
  dataHora?: string;
  fonte: 'datajud' | 'djen';
};

export type VereditoResolveResult = {
  success: boolean;
  fonte: 'datajud' | 'djen' | 'ambos' | 'nenhuma';
  movimentos: VereditoMovimento[];
  comunicacoes: any[];
  dataJudRaw: any | null;
  djenRaw: any | null;
  message?: string;
  datajudError?: string | null;
  djenError?: string | null;
};

function djenToMovimento(item: any): VereditoMovimento {
  const texto = String(item.texto || item.conteudo || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return {
    nome: item.tipoComunicacao || item.tipoDocumento || 'PUBLICAÇÃO DJEN',
    complemento: texto.slice(0, 500),
    descricao: texto,
    dataHora: item.data_disponibilizacao || item.datadisponibilizacao || undefined,
    fonte: 'djen',
  };
}

/**
 * CNJ: tenta DataJud; se não achar movimentos úteis, consulta DJEN e devolve timeline unificada.
 * Não lança — sempre retorna objeto seguro para a UI.
 */
export async function resolveVereditoByCnj(
  cnj: string,
  options?: { fast?: boolean }
): Promise<VereditoResolveResult> {
  const protocolo = (cnj || '').trim();
  if (!protocolo) {
    return {
      success: false,
      fonte: 'nenhuma',
      movimentos: [],
      comunicacoes: [],
      dataJudRaw: null,
      djenRaw: null,
      message: 'Informe um CNJ válido.',
    };
  }

  let dataJudRaw: any = null;
  let datajudError: string | null = null;
  let movimentosDj: VereditoMovimento[] = [];

  try {
    const dj = await fetchDataJud(protocolo, 1, { fast: options?.fast });
    dataJudRaw = dj;
    if (dj && !dj.error) {
      const raw = Array.isArray(dj.movimentos) ? dj.movimentos : [];
      movimentosDj = raw.map((m: any) => ({
        nome: m.nome || m.movimento || m.descricao || 'MOVIMENTO',
        complemento: m.complemento || m.complementoTabelado || '',
        descricao: m.descricao || m.nome || '',
        dataHora: m.dataHora || m.data || m.date || undefined,
        fonte: 'datajud' as const,
      }));
    } else {
      datajudError = dj?.error || dj?.message || 'DataJud sem resultado.';
    }
  } catch (e: any) {
    datajudError = e?.message || 'Falha na comunicação com o DataJud.';
  }

  let djenRaw: any = null;
  let djenError: string | null = null;
  let comunicacoes: any[] = [];
  let movimentosDjen: VereditoMovimento[] = [];

  const needDjen = movimentosDj.length === 0;

  if (needDjen || true) {
    // Sempre tenta DJEN em paralelo conceitual: se DataJud vazio, DJEN é obrigatório;
    // se DataJud ok, ainda enriquece quando possível (best-effort, sem falhar).
    try {
      const djen = await fetchDjenComunicacoes(protocolo);
      djenRaw = djen;
      if (djen?.success) {
        comunicacoes = djen.items || [];
        movimentosDjen = comunicacoes.map(djenToMovimento);
      } else {
        djenError = djen?.error || 'DJEN sem comunicações.';
      }
    } catch (e: any) {
      djenError = e?.message || 'Falha na comunicação com o DJEN.';
    }
  }

  if (movimentosDj.length > 0 && movimentosDjen.length > 0) {
    return {
      success: true,
      fonte: 'ambos',
      movimentos: [...movimentosDj, ...movimentosDjen].sort((a, b) =>
        String(b.dataHora || '').localeCompare(String(a.dataHora || ''))
      ),
      comunicacoes,
      dataJudRaw,
      djenRaw,
      datajudError,
      djenError,
      message: 'Timeline unificada DataJud + DJEN.',
    };
  }

  if (movimentosDj.length > 0) {
    return {
      success: true,
      fonte: 'datajud',
      movimentos: movimentosDj,
      comunicacoes,
      dataJudRaw,
      djenRaw,
      datajudError,
      djenError,
      message: 'Movimentos via DataJud.',
    };
  }

  if (movimentosDjen.length > 0) {
    return {
      success: true,
      fonte: 'djen',
      movimentos: movimentosDjen,
      comunicacoes,
      dataJudRaw,
      djenRaw,
      datajudError,
      djenError,
      message:
        'DataJud sem movimentos para este CNJ. Exibindo publicações do DJEN (diário oficial).',
    };
  }

  return {
    success: false,
    fonte: 'nenhuma',
    movimentos: [],
    comunicacoes: [],
    dataJudRaw,
    djenRaw,
    datajudError,
    djenError,
    message:
      datajudError ||
      djenError ||
      'Nenhum movimento encontrado no DataJud nem no DJEN para este CNJ.',
  };
}
