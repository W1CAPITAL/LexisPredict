'use server';

/**
 * Busca Veredito: CPF/CNPJ/nome somente na carteira autorizada;
 * DataJud público apenas pelo CNJ identificado no cadastro.
 * NÃO usa APIs de saúde/SUS nem scrapers de CPF (privacidade / irrelevância jurídica).
 *
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import {
  getStoredCasesForEmpresa,
  getUserContext,
} from '@/lib/server-db';
import {fetchDataJud} from '@/lib/datajud';
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

/** CPF/CNPJ: busca no cadastro empresarial autorizado. DataJud público recebe apenas CNJ. */
export async function searchProcessesByCpfAction(documento: string, onlyBA = false) {
  try {
    const digits = onlyDigits(documento);
    if (digits.length !== 11 && digits.length !== 14) {
      return {
        success: false,
        items: [] as SearchHit[],
        error: 'CPF/CNPJ deve ter 11 ou 14 dígitos.',
      };
    }

    const { empresa_id } = await getUserContext();
    if(!empresa_id)return {success:false,items:[] as SearchHit[],error:'Não autenticado.'};
    const hits: SearchHit[] = [];

    // Somente colunas do cadastro e documentos efetivamente armazenados.
    // Nunca comparar CPF com telefone ou concatenar campos distintos.
    const cases = await getStoredCasesForEmpresa(empresa_id);
    for (const c of cases || []) {
      const row=c as any;
      const dados=row.dados&&typeof row.dados==='object'?row.dados:{};
      const structured=[row.cpf,row.cnpj,row.documento,row.documento_cliente,
        dados.cpf,dados.cnpj,dados.documento,dados.cpfCnpj];
      const exact=structured.some(value=>onlyDigits(String(value||''))===digits);
      const observation=String(row.observacao||row.observacoes||'');
      const observed=observation.includes(digits) || observation.includes(
        digits.length===11
          ? digits.slice(0,3)+'.'+digits.slice(3,6)+'.'+digits.slice(6,9)+'-'+digits.slice(9)
          : digits.slice(0,2)+'.'+digits.slice(2,5)+'.'+digits.slice(5,8)+'/'+digits.slice(8,12)+'-'+digits.slice(12)
      );
      if(!exact&&!observed)continue;
      hits.push({
        origem:'carteira',
        numeroProcesso:row.protocolo,
        classe:row.situacao||row.evento_tipo||null,
        poloAtivo:[row.cliente].filter(Boolean),poloPassivo:[],
        tribunal:row.tribunal,cliente:row.cliente,
        aviso:'Documento encontrado no cadastro autorizado da empresa; consulta judicial disponível pelo CNJ.',
      });
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
          'Nenhum cadastro empresarial associado a esse documento. A API pública DataJud não permite pesquisa por CPF/CNPJ; identifique o número CNJ em uma fonte autorizada.',
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

/** Nome da parte — busca apenas na carteira empresarial; DataJud público não expõe nomes. */
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

    const hits: SearchHit[]=[];
    const {empresa_id}=await getUserContext();
    if(!empresa_id)return {success:false,items:[],error:'Não autenticado.'};
    const cases=await getStoredCasesForEmpresa(empresa_id);
    const normal=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
    const target=normal(q);
    for(const c of cases||[]){
      const row=c as any;
      const client=String(row.cliente||'');
      const normalized=normal(client);
      if(!normalized||(!normalized.includes(target)&&!(target.length>=12&&target.includes(normalized))))continue;
      hits.push({
        origem:'carteira',numeroProcesso:row.protocolo,
        classe:row.situacao||null,poloAtivo:[client],
        tribunal:row.tribunal,cliente:client,
        aviso:'Nome localizado na carteira empresarial; o DataJud será consultado pelo número CNJ.',
      });
    }

    const finalList = dedupeHits(hits);
    if (finalList.length === 0) {
      return {
        success: true,
        items: [],
        error:
          'Nenhum cliente com esse nome encontrado na carteira desta empresa. A API pública DataJud não oferece pesquisa por nome da parte; identifique o CNJ por fonte autorizada.',
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
      // Comunicações DJEN são publicações, não movimentos do processo.
      // A tela Veredito exibe as fontes em blocos independentes.
      fonte = movimentos.length ? 'ambos' : 'djen';
      if (fonte === 'djen') message = 'Publicações consultadas no DJEN. Movimentações do tribunal não foram confirmadas pelo DataJud.';
    }
  } catch {
    //
  }

  if (!movimentos.length && !comunicacoes.length) {
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
    message: message || 'Histórico DataJud e publicações DJEN separados. Não representam necessariamente os autos completos.',
  };
}
