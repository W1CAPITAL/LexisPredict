'use server';


/**
 * Scanner + PDF de revogacao/substabelecimento.
 * PDF via renderToBuffer (mesmo padrao de document-actions).
 */
import React from 'react';
import { getUserContext, getStoredCasesForEmpresa, listAdvogadosBanca } from '@/lib/server-db';
import {
  nomesCorrespondem,
  ufFromProtocolo,
  processoElegivelRevogacao,
  oabLabel,
  dataExtenso,
  normalizeName,
  extrairAdvogadosDoTexto,
  avaliarViabilidadeSubstabelecimento,
  extrairCpfDoTexto,
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
  advogadosDjen: string[];
  viabilidade: string | null;
  viavelSubstabelecer: boolean;
  djenChecked: boolean;
  analiseClaude?: string | null;
  engineClaude?: string | null;
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
  if (!ctx?.empresa_id) return { success: false as const, error: 'Sessao expirada', banca: [] as any[] };
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

export async function scanCarteiraRevogacaoAction(opts: {
  advogadoRevogarId: string;
  uf?: string | null;
}) {
  const ctx = await getUserContext();
  if (!ctx?.empresa_id) {
    return { success: false as const, error: 'Sessao expirada', items: [] as RevogacaoCaseItem[] };
  }
  const banca = (await listAdvogadosBanca()) || [];
  const leaving = banca.find((a: any) => String(a.id) === String(opts.advogadoRevogarId));
  if (!leaving) {
    return { success: false as const, error: 'Advogado nao encontrado na banca', items: [] as RevogacaoCaseItem[] };
  }

  const cases = (await getStoredCasesForEmpresa(ctx.empresa_id, false)) || [];
  const items: RevogacaoCaseItem[] = [];
  const ufFilter = (opts.uf || '').toUpperCase().trim();

  for (const raw of cases) {
    const c = raw as any;
    const advField = String(c.advogado || c.advogado_responsavel || '').trim();
    if (!advField || !nomesCorrespondem(advField, leaving.nome)) continue;

    const uf = ufFromProtocolo(c.protocolo || c.protocolo_ref, c.tribunal);
    if (ufFilter && ufFilter !== 'TODOS') {
      if (uf && uf !== ufFilter) continue;
      if (!uf && !String(c.tribunal || '').toUpperCase().includes(ufFilter)) continue;
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
      advogadosDjen: [],
      viabilidade: null,
      viavelSubstabelecer: el.ok,
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

export async function reforcoTribunalRevogacaoAction(protocolo: string, opts?: { useClaude?: boolean }) {
  const ctx = await getUserContext();
  if (!ctx?.empresa_id) return { success: false as const, error: 'Sessao' };

  let encerrado = false;
  let cumprimento = false;
  let ultimoNome: string | null = null;
  let resumo = '';
  let djenOk = false;
  const textos: string[] = [];
  let advogadosDjen: string[] = [];
  let cpfDetectado: string | null = null;

  try {
    const { fetchDataJud } = await import('@/lib/datajud');
    const dj = await fetchDataJud(protocolo, 1, { fast: true });
    if (dj && !dj.error) {
      const movs = dj.movimentos || [];
      for (const m of movs.slice(0, 20)) {
        const n = String(m.nome || m.descricao || '');
        if (n) textos.push(n);
      }
      const blob = textos.join(' | ').toUpperCase();
      if (/TRANSITO|BAIXA DEFINIT|ARQUIV|EXTIN/.test(blob)) encerrado = true;
      if (/CUMPRIMENTO\s+DE\s+SENTENCA|EXECUCAO\s+DE\s+SENTENCA/.test(blob)) cumprimento = true;
      if (movs[0]) {
        ultimoNome = movs[0].nome || movs[0].descricao || null;
        resumo = String(ultimoNome || '').slice(0, 180);
      }
    }
  } catch { /* */ }

  try {
    const { fetchDjenPorTexto } = await import('@/lib/djen-busca-texto');
    const dig = protocolo.replace(/\D/g, '');
    if (dig.length >= 15) {
      const r = await fetchDjenPorTexto(dig, {
        dataInicio: new Date(Date.now() - 400 * 86400000).toISOString().slice(0, 10),
        dataFim: new Date().toISOString().slice(0, 10),
        itensPorPagina: 15,
      });
      if (r.success && r.items?.length) {
        djenOk = true;
        for (const it of r.items) {
          const tx = String(it.texto || '');
          if (tx) {
            textos.push(tx);
            advogadosDjen.push(...extrairAdvogadosDoTexto(tx));
          }
        }
        advogadosDjen = Array.from(new Set(advogadosDjen)).slice(0, 8);
        if (advogadosDjen[0]) ultimoNome = advogadosDjen[0];
        const up = textos.join(' ').toUpperCase();
        if (/TRANSITO EM JULGADO|BAIXA DEFINITIVA|ARQUIVAMENTO/.test(up)) encerrado = true;
      }
    }
  } catch { /* */ }

  if (!cpfDetectado) {
    for (const tx of textos) {
      const cpf = extrairCpfDoTexto(tx);
      if (cpf) { cpfDetectado = cpf; break; }
    }
  }

  const via = avaliarViabilidadeSubstabelecimento({
    textos,
    encerradoFlag: encerrado,
    cumprimentoFlag: cumprimento,
  });

  let analiseClaude: string | null = null;
  let engineClaude: string | null = null;
  if (opts?.useClaude) {
    try {
      const { runCascade } = await import('@/lib/ai/cascade');
      const r = await runCascade({
        preferred: 'claude',
        surface: 'revogacao',
        system: `Classifique ELEGIBILIDADE para revogacao/substabelecimento. Responda JSON: {"elegivel":boolean,"motivo":"string curta","advogado_atual":"string|null","cpf":"string|null"}. Sem texto fora do JSON. Nao invente.`,
        messages: [{
          role: 'user',
          content: `Protocolo: ${protocolo}\nEncerrado_flag: ${encerrado}\nCumprimento_flag: ${cumprimento}\nAdvogados_DJEN: ${advogadosDjen.join(', ') || '(nenhum)'}\nTeor:\n${textos.join('\n---\n').slice(0, 6000)}`,
        }],
        temperature: 0.2,
        max_tokens: 400,
      });
      analiseClaude = r.text.slice(0, 1200);
      engineClaude = `${r.engineId}:${r.model}`;
    } catch (e: any) {
      analiseClaude = `IA indisponivel: ${e?.message || e}`;
    }
  }

  const elegivel = !encerrado && !cumprimento && via.viavel;
  return {
    success: true as const,
    protocolo,
    encerrado,
    cumprimento,
    elegivel,
    motivo: encerrado
      ? 'Encerrado/baixa (tribunal)'
      : cumprimento
        ? 'Cumprimento de sentenca'
        : via.motivo,
    ultimoAdvogadoDetectado: ultimoNome,
    advogadosDjen,
    viabilidade: via.motivo,
    viavelSubstabelecer: via.viavel,
    nivelViabilidade: via.nivel,
    resumo,
    djenChecked: djenOk,
    analiseClaude,
    engineClaude,
    cpfDetectado,
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
  advogadosDjen?: string[];
  viabilidade?: string | null;
  observacaoScanner?: string | null;
  comarca?: string;
  clienteCpf?: string | null;
}) {
  const ctx = await getUserContext();
  if (!ctx?.empresa_id) return { success: false as const, error: 'Sessao expirada' };

  const banca = (await listAdvogadosBanca()) || [];
  const leaving = banca.find((a: any) => String(a.id) === String(input.advogadoRevogarId));
  const entering = banca.find((a: any) => String(a.id) === String(input.advogadoNovoId));
  if (!leaving || !entering) {
    return { success: false as const, error: 'Selecione advogados validos da banca' };
  }
  if (String(leaving.id) === String(entering.id)) {
    return { success: false as const, error: 'Substabelecente e substabelecido devem ser diferentes' };
  }
  if (!String(leaving.nome || '').trim() || !String(entering.nome || '').trim()) {
    return { success: false as const, error: 'Banca incompleta: nome do advogado ausente' };
  }
  if (!input.protocolo || !input.cliente) {
    return { success: false as const, error: 'Cliente/protocolo obrigatorios' };
  }

  let viabilidade = input.viabilidade || null;
  let ultimoAdv = input.ultimoAdvogadoDetectado || null;
  let advsDjen = input.advogadosDjen || [];
  // Claude NAO e embutido no PDF — so elegibilidade no scanner

  const preferUf = input.uf || undefined;
  const data: RevogacaoPdfData = {
    comarca: input.comarca || entering.cidade || leaving.cidade || preferUf || 'Sao Paulo',
    dataExtenso: dataExtenso(),
    clienteNome: input.cliente,
    protocolo: input.protocolo,
    tribunal: input.tribunal || undefined,
    revogado: mapAdv(leaving, preferUf),
    substabelecido: mapAdv(entering, preferUf),
    ultimoAdvogadoDetectado: ultimoAdv,
    advogadosDjen: advsDjen,
    viabilidade,
    observacaoScanner: input.observacaoScanner || null,
    clienteCpf: (input as any).clienteCpf || null,
  };

  try {
    const { renderToBuffer } = await import('@react-pdf/renderer');
    const { RevogacaoPoderesPDF } = await import('@/components/pdf/revogacao-poderes-pdf');
    const element = React.createElement(RevogacaoPoderesPDF as any, { data }) as any;
    const pdfBuffer = await renderToBuffer(element);
    const buf = Buffer.from(pdfBuffer);
    if (buf.length < 500) {
      return { success: false as const, error: `PDF gerado invalido (tamanho ${buf.length} bytes)` };
    }
    if (buf[0] !== 0x25 || buf[1] !== 0x50 || buf[2] !== 0x44 || buf[3] !== 0x46) {
      return { success: false as const, error: 'Buffer nao e PDF valido' };
    }
    const base64 = buf.toString('base64');
    const safeClient = normalizeName(input.cliente).replace(/\s+/g, '_').slice(0, 40);
    return {
      success: true as const,
      base64,
      filename: `Revogacao_Substabelecimento_${safeClient}_${input.protocolo.replace(/\D/g, '').slice(0, 20)}.pdf`,
      mime: 'application/pdf',
      bytes: buf.length,
    };
  } catch (e: any) {
    console.error('[revogacao-pdf]', e);
    return { success: false as const, error: e?.message || 'Falha ao gerar PDF' };
  }
}
