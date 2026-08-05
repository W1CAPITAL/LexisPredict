'use server';

/**
 * Scanner de carteira → processos do advogado a revogar → elegíveis (não encerrados / não cumprimento)
 * → PDF de revogação + substabelecimento.
 */
import { getUserContext, getStoredCasesForEmpresa, listAdvogadosBanca } from '@/lib/server-db';
import {
  nomesCorrespondem,
  ufFromProtocolo,
  processoElegivelRevogacao,
  oabLabel,
  dataExtenso,
  normalizeName,
} from '@/lib/revogacao-logic';
import type { RevogacaoPdfData } from '@/components/pdf/revogacao-poderes-pdf';

export type RevogacaoCaseItem = {
  id: string;
  protocolo: string;
  cliente: string;
  advogadoCarteira: string;
  tribunal: string | null;
  uf: string | null;
  elegivel: boolean;
  motivo: string;
  status: string | null;
  encerrado: boolean;
  cumprimento: boolean;
  ultimoAdvogadoDetectado: string | null;
  djenChecked: boolean;
};

function mapAdv(adv: any, preferUf?: string) {
  const o = oabLabel(adv, preferUf);
  return {
    nome: String(adv.nome || ''),
    oabCompleta: o.completa,
    oabCurta: o.curta,
    nacionalidade: adv.nacionalidade || 'brasileiro(a)',
    estadoCivil: adv.estadoCivil || adv.estado_civil || '',
    endereco: [adv.endereco, adv.cidade, adv.uf].filter(Boolean).join(' — ') || undefined,
    email: adv.emailProfissional || adv.email || undefined,
    telefone: adv.telefone || adv.celular || undefined,
  };
}

export async function listBancaForRevogacaoAction() {
  const ctx = await getUserContext();
  if (!ctx?.empresa_id) return { success: false as const, error: 'Sessão expirada', banca: [] as any[] };
  const banca = (await listAdvogadosBanca()) || [];
  return {
    success: true as const,
    banca: banca.map((a: any) => ({
      id: a.id,
      nome: a.nome,
      uf: a.uf || Object.keys(a.oabs || {})[0] || 'SP',
      oabs: a.oabs || {},
      ativo: a.ativo !== false,
    })),
  };
}

/**
 * Lista processos do usuário em que o advogado da carteira corresponde ao advogado a revogar.
 * Filtro opcional por UF. Não chama DJEN ainda (rápido).
 */
export async function scanCarteiraRevogacaoAction(opts: {
  advogadoRevogarId: string;
  uf?: string | null;
}) {
  const ctx = await getUserContext();
  if (!ctx?.empresa_id) {
    return { success: false as const, error: 'Sessão expirada', items: [] as RevogacaoCaseItem[] };
  }
  const banca = (await listAdvogadosBanca()) || [];
  const leaving = banca.find((a: any) => String(a.id) === String(opts.advogadoRevogarId));
  if (!leaving) {
    return { success: false as const, error: 'Advogado não encontrado na banca', items: [] as RevogacaoCaseItem[] };
  }

  const cases = (await getStoredCasesForEmpresa(ctx.empresa_id, false)) || [];
  const items: RevogacaoCaseItem[] = [];
  const ufFilter = (opts.uf || '').toUpperCase().trim();

  for (const raw of cases) {
    const c = raw as any;
    const advField = String(c.advogado || c.advogado_responsavel || '').trim();
    if (!advField || !nomesCorrespondem(advField, leaving.nome)) continue;

    const uf = ufFromProtocolo(c.protocolo || c.protocolo_ref, c.tribunal);
    if (ufFilter && ufFilter !== 'TODOS' && uf && uf !== ufFilter) continue;
    // se filtro UF e não deu para extrair UF, mantém (não descarta à cegas)
    if (ufFilter && ufFilter !== 'TODOS' && !uf) {
      // tenta match no texto do tribunal
      if (!String(c.tribunal || '').toUpperCase().includes(ufFilter)) continue;
    }

    const el = processoElegivelRevogacao(c);
    items.push({
      id: String(c.id || c.db_id || c.protocolo),
      protocolo: String(c.protocolo || c.protocolo_ref || ''),
      cliente: String(c.cliente || ''),
      advogadoCarteira: advField,
      tribunal: c.tribunal || null,
      uf,
      elegivel: el.ok,
      motivo: el.motivo,
      status: c.status || null,
      encerrado: !!c.datajud_encerrado_tribunal,
      cumprimento: !!c.em_cumprimento_sentenca,
      ultimoAdvogadoDetectado: advField,
      djenChecked: false,
    });
  }

  items.sort((a, b) => {
    if (a.elegivel !== b.elegivel) return a.elegivel ? -1 : 1;
    return a.cliente.localeCompare(b.cliente, 'pt-BR');
  });

  return {
    success: true as const,
    items,
    advogadoNome: leaving.nome as string,
    total: items.length,
    elegiveis: items.filter((i) => i.elegivel).length,
  };
}

/**
 * Reforço DJEN/DataJud leve por protocolo (status + indício de advogado atual).
 * Economiza token: sem Claude; só APIs públicas já usadas no app.
 */
export async function reforcoTribunalRevogacaoAction(protocolo: string) {
  const ctx = await getUserContext();
  if (!ctx?.empresa_id) return { success: false as const, error: 'Sessão' };

  let encerrado = false;
  let cumprimento = false;
  let ultimoNome: string | null = null;
  let resumo = '';
  let djenOk = false;

  try {
    const { fetchDataJud } = await import('@/lib/datajud');
    const dj = await fetchDataJud(protocolo, 1, { fast: true });
    if (dj && !dj.error) {
      const movs = dj.movimentos || [];
      const blob = movs
        .slice(0, 15)
        .map((m: any) => String(m.nome || m.descricao || ''))
        .join(' | ')
        .toUpperCase();
      if (/TRANSITO|BAIXA DEFINIT|ARQUIV|EXTIN/.test(blob)) encerrado = true;
      if (/CUMPRIMENTO\s+DE\s+SENTENCA|EXECUCAO\s+DE\s+SENTENCA/.test(blob)) cumprimento = true;
      if (movs[0]) {
        ultimoNome = movs[0].nome || movs[0].descricao || null;
        resumo = String(ultimoNome || '').slice(0, 180);
      }
    }
  } catch {
    /* */
  }

  try {
    const { fetchDjenPorTexto } = await import('@/lib/djen-busca-texto');
    const dig = protocolo.replace(/\D/g, '');
    if (dig.length >= 15) {
      const r = await fetchDjenPorTexto(dig, {
        dataInicio: new Date(Date.now() - 400 * 86400000).toISOString().slice(0, 10),
        dataFim: new Date().toISOString().slice(0, 10),
        itensPorPagina: 10,
      });
      if (r.success && r.items?.length) {
        djenOk = true;
        const textos = r.items.map((i: any) => String(i.texto || '')).join(' ');
        const up = textos.toUpperCase();
        if (/TRANSITO EM JULGADO|BAIXA DEFINITIVA|ARQUIVAMENTO/.test(up)) encerrado = true;
        // tenta capturar "Dr(a). NOME" recente
        const m = textos.match(/Dr\.?\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÀ-ú\s]{5,40})/);
        if (m) ultimoNome = m[1].trim();
      }
    }
  } catch {
    /* */
  }

  const elegivel = !encerrado && !cumprimento;
  return {
    success: true as const,
    protocolo,
    encerrado,
    cumprimento,
    elegivel,
    motivo: encerrado
      ? 'Encerrado/baixa (tribunal)'
      : cumprimento
        ? 'Cumprimento de sentença'
        : 'Ativo no reforço tribunal',
    ultimoAdvogadoDetectado: ultimoNome,
    resumo,
    djenChecked: djenOk,
  };
}

export async function generateRevogacaoPdfAction(input: {
  protocolo: string;
  cliente: string;
  tribunal?: string | null;
  uf?: string | null;
  advogadoRevogarId: string;
  advogadoNovoId: string;
  ultimoAdvogadoDetectado?: string | null;
  observacaoScanner?: string | null;
  comarca?: string;
}) {
  const ctx = await getUserContext();
  if (!ctx?.empresa_id) return { success: false as const, error: 'Sessão expirada' };

  const banca = (await listAdvogadosBanca()) || [];
  const leaving = banca.find((a: any) => String(a.id) === String(input.advogadoRevogarId));
  const entering = banca.find((a: any) => String(a.id) === String(input.advogadoNovoId));
  if (!leaving || !entering) {
    return { success: false as const, error: 'Selecione advogados válidos da banca' };
  }
  if (String(leaving.id) === String(entering.id)) {
    return { success: false as const, error: 'Substabelecente e substabelecido devem ser diferentes' };
  }

  const preferUf = input.uf || undefined;
  const data: RevogacaoPdfData = {
    comarca: input.comarca || entering.cidade || leaving.cidade || preferUf || 'São Paulo',
    dataExtenso: dataExtenso(),
    clienteNome: input.cliente,
    protocolo: input.protocolo,
    tribunal: input.tribunal || undefined,
    revogado: mapAdv(leaving, preferUf),
    substabelecido: mapAdv(entering, preferUf),
    ultimoAdvogadoDetectado: input.ultimoAdvogadoDetectado || null,
    observacaoScanner: input.observacaoScanner || null,
  };

  try {
    const { pdf } = await import('@react-pdf/renderer');
    const { RevogacaoPoderesPDF } = await import('@/components/pdf/revogacao-poderes-pdf');
    const React = await import('react');
    const instance = pdf(React.createElement(RevogacaoPoderesPDF, { data }) as any);
    const buffer = await instance.toBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const safeClient = normalizeName(input.cliente).replace(/\s+/g, '_').slice(0, 40);
    return {
      success: true as const,
      base64,
      filename: `Revogacao_Substabelecimento_${safeClient}_${input.protocolo.replace(/\D/g, '').slice(0, 20)}.pdf`,
      mime: 'application/pdf',
    };
  } catch (e: any) {
    console.error('[revogacao-pdf]', e);
    return { success: false as const, error: e?.message || 'Falha ao gerar PDF' };
  }
}
