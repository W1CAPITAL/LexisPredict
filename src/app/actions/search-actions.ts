'use server';

/**
 * Busca local por CPF/CNPJ/nome na carteira; fontes oficiais são consultadas somente após obter o CNJ.
 * A API pública DataJud não expõe pesquisa por documentos ou nome de partes.
 * NÃO usa APIs de saúde/SUS nem scrapers de CPF (privacidade / irrelevância jurídica).
 *
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import {
  getStoredCasesForEmpresa,
  getUserContext,
} from '@/lib/server-db';
import { fetchDataJud } from '@/lib/datajud';
import { fetchDjenComunicacoes } from '@/lib/djen';

export type SearchHit = {
  origem: 'carteira' | 'datajud' | 'djen' | 'nome';
  numeroProcesso: string;
  processoId?: number;
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
    const key = n.length===20 ? n : `local:${x.processoId||x.numeroProcesso}`;
    if ((!n&&!x.processoId)||seen.has(key)) continue;
    seen.add(key);
    out.push({ ...x, numeroProcesso: n.length===20 ? normalizeCnj(x.numeroProcesso) : x.numeroProcesso });
  }
  return out;
}

/** CPF/CNPJ: pesquisa somente os dados locais da carteira, nunca na API pública DataJud. */
export async function searchProcessesByCpfAction(documento: string, onlyBA = false) {
  try {
    const digits = onlyDigits(documento);
    if (digits.length < 11) {
      return { success:false, items:[] as SearchHit[], error:'CPF/CNPJ inválido (mín. 11 dígitos).' };
    }
    const { empresa_id } = await getUserContext();
    if (!empresa_id) return { success:false, items:[] as SearchHit[], error:'Empresa não identificada.' };
    const cases = await getStoredCasesForEmpresa(empresa_id);
    const hits:SearchHit[]=[];
    for(const raw of cases||[]){
      const c=raw as any;
      const dados=c.dados&&typeof c.dados==='object'?c.dados:{};
      const blob=onlyDigits([
        c.cpf,c.cnpj,c.documento,c.numero_documento,c.numeroDocumentoPrincipal,
        dados.cpf,dados.cnpj,dados.documento,dados.numeroDocumento,dados.numeroDocumentoPrincipal,
        c.observacao,dados.observacao,c.cliente,c.cliente_nome,c.telefone,dados.telefone,
        c.protocolo,c.protocolo_ref,
      ].filter(Boolean).join(' '));
      if(!blob.includes(digits))continue;
      const classe=String(c.situacao||c.evento_tipo||c.classe||dados.situacao||'');
      if(onlyBA&&!/BUSCA\\s*E?\\s*APREENS/i.test(classe))continue;
      const cnj=String(c.protocolo||c.protocolo_ref||c.numeroProcesso||'').trim();
      hits.push({
        origem:'carteira',numeroProcesso:cnj||'CNJ não cadastrado',processoId:Number(c.id)||undefined,
        classe:classe||null,poloAtivo:[c.cliente||c.cliente_nome].filter(Boolean),poloPassivo:[],
        tribunal:c.tribunal||null,cliente:c.cliente||c.cliente_nome||undefined,
        aviso:cnj?'Encontrado no cadastro local da empresa.':'Encontrado no CRM, mas sem CNJ cadastrado.',
      });
    }
    const finalList=dedupeHits(hits);
    return finalList.length
      ?{success:true,items:finalList}
      :{success:true,items:[],error:'Nenhum cadastro correspondente encontrado na carteira. A API pública DataJud não pesquisa CPF/CNPJ; obtenha o CNJ pela consulta oficial do tribunal.'};
  } catch (e:any) {
    return { success:false,items:[],error:e?.message||'Falha na busca local por CPF/CNPJ.' };
  }
}

/** Nome da parte: pesquisa local na carteira. DataJud exige CNJ. */
export async function searchProcessesByNomeAction(nome: string): Promise<{
  success:boolean;items:SearchHit[];error?:string;
}> {
  try {
    const q=String(nome||'').trim();
    if(q.length<5)return {success:false,items:[],error:'Nome muito curto (mín. 5 caracteres).' };
    const {empresa_id}=await getUserContext();
    if(!empresa_id)return {success:false,items:[],error:'Empresa não identificada.'};
    const cases=await getStoredCasesForEmpresa(empresa_id);
    const qUp=q.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toUpperCase();
    const hits:SearchHit[]=[];
    for(const raw of cases||[]){
      const c=raw as any;
      const dados=c.dados&&typeof c.dados==='object'?c.dados:{};
      const cliente=String(c.cliente||c.cliente_nome||dados.cliente||dados.nomeParte||'').trim();
      const normalized=cliente.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toUpperCase();
      if(!normalized||(!normalized.includes(qUp)&&!qUp.includes(normalized.slice(0,12))))continue;
      const cnj=String(c.protocolo||c.protocolo_ref||c.numeroProcesso||'').trim();
      hits.push({
        origem:'carteira',numeroProcesso:cnj||'CNJ não cadastrado',processoId:Number(c.id)||undefined,
        classe:c.situacao||c.evento_tipo||null,poloAtivo:[cliente].filter(Boolean),
        poloPassivo:[],tribunal:c.tribunal||null,cliente:cliente||undefined,
        aviso:cnj?'Correspondência encontrada na carteira local.':'Cadastro encontrado, mas sem CNJ vinculado.',
      });
    }
    const finalList=dedupeHits(hits);
    return finalList.length
      ?{success:true,items:finalList}
      :{success:true,items:[],error:'Nenhum cadastro correspondente encontrado na carteira. A API pública DataJud não pesquisa nomes de partes; consulte o tribunal ou obtenha o CNJ.'};
  } catch(e:any) {
    return {success:false,items:[],error:e?.message||'Falha na busca local por nome.'};
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
  let dataJudRestricted = false;

  try {
    const dj = await fetchDataJud(protocolo, 1, { fast: false });
    dataJudRestricted = dj?.errorCode === 'terms_restricted';
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
      if (fonte === 'djen') message = dataJudRestricted?'Publicações consultadas no DJEN. DataJud não foi acionado por restrição dos termos de uso.':'Publicações consultadas no DJEN. Movimentações do tribunal não foram confirmadas pelo DataJud.';
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
        dataJudRestricted?'DataJud não consultado: os termos vigentes vedam uso comercial da API pública sem autorização do CNJ. Consulte a fonte oficial do tribunal e o DJEN.':'Sem movimentos confirmados no DataJud e sem publicações no DJEN para este CNJ. Confira o número no site do tribunal.',
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
