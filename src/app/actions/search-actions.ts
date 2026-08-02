'use server';

/**
 * Busca híbrida Veredito: carteira local + DataJud (CPF/nome) + enriquecimento por CNJ.
 * DataJud muitas vezes NÃO indexa CPF — por isso carteira local e busca por nome são prioritárias.
 * NÃO usa APIs de saúde/SUS nem scrapers de CPF (privacidade / irrelevância jurídica).
 *
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import {
  getStoredCasesForEmpresa,
  getUserContext,
} from '@/lib/server-db';
import {
  searchDataJudByCpf,
  searchDataJudByNome,
  fetchDataJud,
} from '@/lib/datajud';
import { fetchDjenComunicacoes } from '@/lib/djen';

export type SearchHit = {
  origem: 'carteira' | 'datajud' | 'djen' | 'nome';
  numeroProcesso: string;
  classe?: string | null;
  poloAtivo?: string[];
  poloPassivo?: string[];
  tribunal?: string | null;
  grau?: string | null;
  isBuscaApreensao?: boolean;
  cliente?: string;
  aviso?: string;
};

function onlyDigits(s: string) {
  return String(s || '').replace(/\D/g, '');
}

function normalizeCnj(s: string) {
  const d = onlyDigits(s);
  if (d.length !== 20) return s;
  return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16)}`;
}

function dedupeHits(items: SearchHit[]): SearchHit[] {
  const seen = new Set<string>();
  const out: SearchHit[] = [];
  for (const x of items) {
    const n = onlyDigits(x.numeroProcesso);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push({ ...x, numeroProcesso: normalizeCnj(x.numeroProcesso) });
  }
  return out;
}

/** CPF/CNPJ: 1) carteira local 2) DataJud multi-tribunal 3) nomes da carteira → DataJud nome */
export async function searchProcessesByCpfAction(documento: string, onlyBA = false) {
  try {
    const digits = onlyDigits(documento);
    if (digits.length < 11) {
      return {
        success: false,
        items: [] as SearchHit[],
        error: 'CPF/CNPJ inválido (mín. 11 dígitos).',
      };
    }

    const { empresa_id } = await getUserContext();
    const hits: SearchHit[] = [];

    // 1) Carteira local — match em observação, cliente, telefone, protocolo
    if (empresa_id) {
      const cases = await getStoredCasesForEmpresa(empresa_id);
      for (const c of cases || []) {
        const blob = onlyDigits(
          `${(c as any).observacao || ''} ${(c as any).cliente || ''} ${(c as any).telefone || ''} ${(c as any).protocolo || ''}`
        );
        if (!blob.includes(digits)) continue;
        hits.push({
          origem: 'carteira',
          numeroProcesso: (c as any).protocolo,
          classe: (c as any).situacao || (c as any).evento_tipo || null,
          poloAtivo: [(c as any).cliente].filter(Boolean),
          poloPassivo: [],
          tribunal: (c as any).tribunal,
          cliente: (c as any).cliente,
          aviso: 'Encontrado na sua carteira (documento em cadastro/observação).',
        });
      }
    }

    // 2) DataJud por documento (pode retornar 0 — limitação conhecida da API pública)
    try {
      const remoto = await searchDataJudByCpf(digits, { onlyBA, size: 12 });
      for (const r of remoto.items || []) {
        hits.push({
          origem: 'datajud',
          numeroProcesso: r.numeroProcesso,
          classe: r.classe,
          poloAtivo: r.poloAtivo || [],
          poloPassivo: r.poloPassivo || [],
          tribunal: r.tribunal,
          grau: r.grau,
          isBuscaApreensao: r.isBuscaApreensao,
        });
      }
    } catch {
      // segue
    }

    // 3) Fallback por NOME dos clientes da carteira que bateram CPF
    const nomes = Array.from(
      new Set(
        hits
          .filter((h) => h.origem === 'carteira' && h.cliente)
          .map((h) => String(h.cliente))
      )
    ).slice(0, 4);

    for (const nome of nomes) {
      try {
        const r = await searchDataJudByNome(nome, { size: 8 });
        for (const item of r.items || []) {
          hits.push({
            origem: 'nome',
            numeroProcesso: item.numeroProcesso,
            classe: item.classe,
            poloAtivo: item.poloAtivo || [],
            poloPassivo: item.poloPassivo || [],
            tribunal: item.tribunal,
            grau: item.grau,
            aviso: `Via nome na carteira: ${nome}`,
          });
        }
      } catch {
        // next
      }
    }

    let finalList = dedupeHits(hits);
    if (onlyBA) {
      finalList = finalList.filter(
        (x) =>
          x.isBuscaApreensao ||
          /BUSCA\s*E?\s*APREENS/i.test(String(x.classe || ''))
      );
    }

    if (finalList.length === 0) {
      return {
        success: true,
        items: [],
        error:
          'Nenhum processo encontrado. A API pública DataJud frequentemente não indexa CPF/CNPJ. Cadastre o CNJ na carteira ou busque por NOME da parte / número CNJ. O DJEN só consulta por processo (CNJ), não por CPF.',
      };
    }

    return { success: true, items: finalList };
  } catch (e: any) {
    return {
      success: false,
      items: [],
      error: e?.message || 'Falha na busca por CPF',
    };
  }
}

/** Nome da parte — DataJud + match parcial na carteira */
export async function searchProcessesByNomeAction(nome: string): Promise<{
  success: boolean;
  items: SearchHit[];
  error?: string;
}> {
  try {
    const q = String(nome || '').trim();
    if (q.length < 5) {
      return { success: false, items: [], error: 'Nome muito curto (mín. 5 caracteres).' };
    }

    const hits: SearchHit[] = [];
    const { empresa_id } = await getUserContext();

    if (empresa_id) {
      const cases = await getStoredCasesForEmpresa(empresa_id);
      const qUp = q.toUpperCase();
      for (const c of cases || []) {
        const cli = String((c as any).cliente || '').toUpperCase();
        if (!cli.includes(qUp) && !qUp.includes(cli.slice(0, 12))) continue;
        hits.push({
          origem: 'carteira',
          numeroProcesso: (c as any).protocolo,
          classe: (c as any).situacao || null,
          poloAtivo: [(c as any).cliente].filter(Boolean),
          tribunal: (c as any).tribunal,
          cliente: (c as any).cliente,
          aviso: 'Match na carteira local.',
        });
      }
    }

    try {
      const r = await searchDataJudByNome(q, { size: 12 });
      for (const item of r.items || []) {
        hits.push({
          origem: 'datajud',
          numeroProcesso: item.numeroProcesso,
          classe: item.classe,
          poloAtivo: item.poloAtivo || [],
          poloPassivo: item.poloPassivo || [],
          tribunal: item.tribunal,
          grau: item.grau,
          isBuscaApreensao: item.isBuscaApreensao,
        });
      }
    } catch {
      //
    }

    const finalList = dedupeHits(hits);
    if (finalList.length === 0) {
      return {
        success: true,
        items: [],
        error:
          'Nenhum processo no DataJud nem na carteira para este nome. Tente o CNJ completo ou verifique a grafia. DJEN não busca por nome — só por número do processo.',
      };
    }
    return { success: true, items: finalList };
  } catch (e: any) {
    return {
      success: false,
      items: [],
      error: e?.message || 'Falha na busca por nome',
    };
  }
}

/**
 * Após escolher um CNJ na lista: carrega DataJud e, se vazio, DJEN.
 */
export async function enrichProcessTimelineAction(cnj: string) {
  const protocolo = String(cnj || '').trim();
  if (!protocolo) return { success: false, movimentos: [], comunicacoes: [], message: 'CNJ vazio' };

  let movimentos: any[] = [];
  let comunicacoes: any[] = [];
  let fonte: 'datajud' | 'djen' | 'ambos' | 'nenhuma' = 'nenhuma';
  let message = '';

  try {
    const dj = await fetchDataJud(protocolo, 1, { fast: false });
    if (dj && !dj.error && Array.isArray(dj.movimentos) && dj.movimentos.length) {
      movimentos = dj.movimentos.map((m: any) => ({ ...m, fonte: 'datajud' }));
      fonte = 'datajud';
    }
  } catch {
    //
  }

  try {
    const djen = await fetchDjenComunicacoes(protocolo);
    if (djen?.success && djen.items?.length) {
      comunicacoes = djen.items;
      const fromDjen = djen.items.map((item: any) => ({
        nome: item.tipoComunicacao || 'PUBLICAÇÃO DJEN',
        complemento: String(item.texto || '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 500),
        dataHora: item.data_disponibilizacao,
        fonte: 'djen',
      }));
      movimentos = [...movimentos, ...fromDjen];
      fonte = movimentos.some((m) => m.fonte === 'datajud') ? 'ambos' : 'djen';
      if (fonte === 'djen') message = 'DataJud sem movimentos — timeline via DJEN.';
    }
  } catch {
    //
  }

  if (!movimentos.length) {
    return {
      success: false,
      movimentos: [],
      comunicacoes: [],
      fonte: 'nenhuma' as const,
      message:
        'Sem movimentos no DataJud e sem publicações no DJEN para este CNJ. Confira o número no site do tribunal.',
    };
  }

  return {
    success: true,
    movimentos,
    comunicacoes,
    fonte,
    message: message || 'Timeline carregada.',
  };
}
