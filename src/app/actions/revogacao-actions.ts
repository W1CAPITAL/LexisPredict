'use server';

/**
 * Scanner + PDF de revogacao/substabelecimento.
 * Reforco exclusivo DJEN (sem DataJud) + dados da carteira. Preenche CPF/email/banco/acao.
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
  /** Dados vindos da carteira (Processos / cadastro) */
  cpf?: string | null;
  email?: string | null;
  telefone?: string | null;
  estado_civil?: string | null;
  endereco?: string | null;
  nacionalidade?: string | null;
  emprego?: string | null;
  parte_passiva?: string | null;
  parte_passiva_cnpj?: string | null;
  classe_acao?: string | null;
};

function onlyDigits(s: string) {
  return String(s || '').replace(/\D/g, '');
}

function formatCpfMask(digits: string) {
  const d = onlyDigits(digits);
  if (d.length !== 11) return d || '';
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function pickFromCase(c: any) {
  const dados = typeof c.dados === 'object' && c.dados ? c.dados : {};
  const cpfRaw =
    c.cpf ||
    dados.cpf ||
    c.CPF ||
    dados.CPF ||
    '';
  const email =
    String(c.email || dados.email || c.EMAIL || dados.EMAIL || '').trim() || null;
  const telefone =
    onlyDigits(c.telefone || dados.telefone || '') || null;
  const estado_civil =
    String(
      c.estado_civil ||
        dados.estado_civil ||
        c.estadoCivil ||
        dados.estadoCivil ||
        ''
    )
      .trim()
      .toUpperCase() || null;
  const endereco =
    String(
      c.endereco ||
        dados.endereco ||
        c.endereco_completo ||
        dados.endereco_completo ||
        [c.logradouro || dados.logradouro, c.cidade || dados.cidade, c.uf_cliente || dados.uf_cliente]
          .filter(Boolean)
          .join(', ')
    )
      .trim() || null;
  const nacionalidade =
    String(c.nacionalidade || dados.nacionalidade || 'BRASILEIRA')
      .trim()
      .toUpperCase() || 'BRASILEIRA';
  const emprego =
    String(c.emprego || dados.emprego || c.profissao || dados.profissao || '')
      .trim()
      .toUpperCase() || null;
  const parte_passiva =
    String(
      c.parte_passiva ||
        dados.parte_passiva ||
        c.reu ||
        dados.reu ||
        ''
    )
      .trim()
      .toUpperCase() || null;
  const parte_passiva_cnpj =
    onlyDigits(
      c.parte_passiva_cnpj || dados.parte_passiva_cnpj || c.cnpj_passivo || ''
    ) || null;
  const classe_acao =
    String(
      c.classe_acao ||
        dados.classe_acao ||
        c.classe ||
        dados.classe ||
        c.tipo ||
        dados.tipo ||
        ''
    )
      .trim()
      .toUpperCase() || null;

  const cpfDigits = onlyDigits(cpfRaw);
  return {
    cpf: cpfDigits.length === 11 ? formatCpfMask(cpfDigits) : cpfDigits || null,
    email,
    telefone,
    estado_civil,
    endereco: endereco || null,
    nacionalidade,
    emprego,
    parte_passiva,
    parte_passiva_cnpj,
    classe_acao,
  };
}

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
  let comCpf = 0;

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
    const extra = pickFromCase(c);
    if (extra.cpf && onlyDigits(extra.cpf).length === 11) comCpf += 1;

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
      ...extra,
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
    comCpfCarteira: comCpf,
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
  let emailDetectado: string | null = null;
  let estadoCivilDetectado: string | null = null;
  let enderecoDetectado: string | null = null;
  let bancoDetectado: string | null = null;
  let acaoDetectada: string | null = null;
  let cnpjPassivo: string | null = null;

  // 1) Carteira local (instantâneo) — base para preencher campos
  try {
    const cases = (await getStoredCasesForEmpresa(ctx.empresa_id, false)) || [];
    const dig = onlyDigits(protocolo);
    const found = cases.find(
      (c: any) => onlyDigits(c.protocolo || c.protocolo_ref || '') === dig
    );
    if (found) {
      const extra = pickFromCase(found);
      if (extra.cpf && onlyDigits(extra.cpf).length === 11) cpfDetectado = extra.cpf;
      if (extra.email) emailDetectado = extra.email;
      if (extra.estado_civil) estadoCivilDetectado = extra.estado_civil;
      if (extra.endereco) enderecoDetectado = extra.endereco;
      if (extra.parte_passiva) bancoDetectado = extra.parte_passiva;
      if (extra.classe_acao) acaoDetectada = extra.classe_acao;
      if (extra.parte_passiva_cnpj) cnpjPassivo = extra.parte_passiva_cnpj;
      if (found.datajud_encerrado_tribunal) encerrado = true;
      if (found.em_cumprimento_sentenca) cumprimento = true;
    }
  } catch { /* */ }

  // 2) SOMENTE DJEN (sem DataJud) — janela 90 dias para velocidade
  try {
    const { fetchDjenComunicacoes, plainTextFromDjen } = await import('@/lib/djen');
    const dig = onlyDigits(protocolo);
    if (dig.length === 20) {
      const r = await fetchDjenComunicacoes(protocolo, {
        dataInicio: new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10),
        dataFim: new Date().toISOString().slice(0, 10),
      });
      if (r.success && r.items?.length) {
        djenOk = true;
        const first = r.items[0];
        if (first.nomeClasse && !acaoDetectada) {
          acaoDetectada = String(first.nomeClasse).toUpperCase();
        }
        for (const it of r.items) {
          const tx = plainTextFromDjen(String(it.texto || ''));
          if (tx) textos.push(tx);
          advogadosDjen.push(...extrairAdvogadosDoTexto(tx || String(it.texto || '')));
          for (const d of it.destinatarios || []) {
            const nome = String(d.nome || '').trim().toUpperCase();
            if (!nome) continue;
            const polo = String(d.polo || '').toUpperCase();
            if (
              /PASSIVO|R[EÉ]U|REQUERID|EXECUTAD/.test(polo) ||
              /BANCO|S\.?\s*A\.?|LTDA|FINANCEIRA|SAFRA|ITA[UÚ]|BRADESCO|SANTANDER|CAIXA|INTER\b|NUBANK|PAN\b|BMG|C6/.test(nome)
            ) {
              if (!bancoDetectado) bancoDetectado = nome;
            }
            for (const a of d.advogados || []) {
              const an = String(a || '').trim();
              if (an) advogadosDjen.push(an);
            }
          }
        }
        advogadosDjen = Array.from(new Set(advogadosDjen.map((a) => a.toUpperCase()))).slice(0, 8);
        if (advogadosDjen[0]) ultimoNome = advogadosDjen[0];

        const corpus = textos.join('\n');
        const up = corpus.toUpperCase();
        if (/TRANSITO EM JULGADO|BAIXA DEFINITIVA|ARQUIVADO DEFINIT|ARQUIVAMENTO DEFINIT/.test(up)) {
          encerrado = true;
        }
        if (/CUMPRIMENTO\s+DE\s+SENTEN[CÇ]A|EXECU[CÇ][AÃ]O\s+DE\s+SENTEN[CÇ]A/.test(up)) {
          cumprimento = true;
        }
        if (!cpfDetectado) {
          const cpf = extrairCpfDoTexto(corpus);
          if (cpf) cpfDetectado = formatCpfMask(cpf);
        }
        if (!emailDetectado) {
          const em = corpus.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
          if (em) emailDetectado = em[0].toLowerCase();
        }
        if (!estadoCivilDetectado) {
          const ec = up.match(/\b(SOLTEIR[OA]|CASAD[OA]|DIVORCIAD[OA]|VI[UÚ]V[OA]|UNI[AÃ]O EST[AÁ]VEL)\b/);
          if (ec) estadoCivilDetectado = ec[1];
        }
        if (!cnpjPassivo) {
          const m = corpus.match(/\b(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})\b/);
          if (m) {
            const d = m[1].replace(/\D/g, '');
            if (d.length === 14) cnpjPassivo = d;
          }
        }
        if (!bancoDetectado) {
          const banks = [
            'BANCO DO BRASIL', 'BANCO ITAÚ', 'BANCO ITAU', 'ITAÚ UNIBANCO', 'ITAU UNIBANCO',
            'BANCO BRADESCO', 'BANCO SANTANDER', 'CAIXA ECONÔMICA', 'CAIXA ECONOMICA',
            'NUBANK', 'BANCO INTER', 'BANCO PAN', 'BANCO BMG', 'BANCO C6', 'BANCO SAFRA',
            'BANCO ORIGINAL', 'BANCO DAYCOVAL', 'CREFISA', 'BANCO AGIBANK', 'BANCO MASTER',
          ];
          for (const b of banks) {
            if (up.includes(b)) {
              bancoDetectado = b;
              break;
            }
          }
        }
        if (textos[0]) resumo = textos[0].slice(0, 180);
      }
    }
  } catch { /* */ }

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
          content: `Protocolo: ${protocolo}\nEncerrado_flag: ${encerrado}\nCumprimento_flag: ${cumprimento}\nAdvogados_DJEN: ${advogadosDjen.join(', ') || '(nenhum)'}\nTeor:\n${textos.join('\n---\n').slice(0, 4000)}`,
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
      ? 'Encerrado/baixa (DJEN)'
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
    emailDetectado,
    estadoCivilDetectado,
    enderecoDetectado,
    bancoDetectado,
    acaoDetectada,
    cnpjPassivo,
  };
}

export async function generateRevogacaoPdfAction(input: {
  protocolo: string;
  cliente: string;
  tribunal?: string | null;
  uf?: string | null;
  advogadoRevogarId: string;
  advogadoNovoId?: string;
  ultimoAdvogadoDetectado?: string | null;
  advogadosDjen?: string[];
  viabilidade?: string | null;
  observacaoScanner?: string | null;
  comarca?: string;
  clienteCpf?: string | null;
  clienteEmail?: string | null;
  clienteEstadoCivil?: string | null;
  clienteEndereco?: string | null;
  clienteNacionalidade?: string | null;
  partePassiva?: string | null;
  partePassivaCnpj?: string | null;
  classeAcao?: string | null;
  /** Se true, inclui banco/ação no corpo do PDF */
  incluirPartePassivaNoPdf?: boolean;
  incluirAcaoNoPdf?: boolean;
  /** Se true, gera apenas revogação (sem substabelecimento) */
  somenteRevogacao?: boolean;
}) {
  const ctx = await getUserContext();
  if (!ctx?.empresa_id) return { success: false as const, error: 'Sessao expirada' };

  const banca = (await listAdvogadosBanca()) || [];
  const leaving = banca.find((a: any) => String(a.id) === String(input.advogadoRevogarId));
  if (!leaving) {
    return { success: false as const, error: 'Selecione advogado valido para revogar' };
  }
  if (!String(leaving.nome || '').trim()) {
    return { success: false as const, error: 'Banca incompleta: nome do advogado ausente' };
  }
  const entering = input.advogadoNovoId
    ? banca.find((a: any) => String(a.id) === String(input.advogadoNovoId))
    : null;
  if (!input.somenteRevogacao) {
    if (!entering) {
      return { success: false as const, error: 'Selecione advogado validos da banca para substabelecimento' };
    }
    if (String(leaving.id) === String(entering.id)) {
      return { success: false as const, error: 'Substabelecente e substabelecido devem ser diferentes' };
    }
    if (!String(entering.nome || '').trim()) {
      return { success: false as const, error: 'Banca incompleta: nome do advogado ausente' };
    }
  }
  if (!input.protocolo || !input.cliente) {
    return { success: false as const, error: 'Cliente/protocolo obrigatorios' };
  }

  // Completar a partir da carteira se o front nao mandou
  let clienteCpf = input.clienteCpf || null;
  let clienteEmail = input.clienteEmail || null;
  let clienteEstadoCivil = input.clienteEstadoCivil || null;
  let clienteEndereco = input.clienteEndereco || null;
  let clienteNacionalidade = input.clienteNacionalidade || null;
  let partePassiva = input.partePassiva || null;
  let partePassivaCnpj = input.partePassivaCnpj || null;
  let classeAcao = input.classeAcao || null;

  try {
    const cases = (await getStoredCasesForEmpresa(ctx.empresa_id, false)) || [];
    const dig = onlyDigits(input.protocolo);
    const found = cases.find(
      (c: any) => onlyDigits(c.protocolo || c.protocolo_ref || '') === dig
    );
    if (found) {
      const extra = pickFromCase(found);
      if (!clienteCpf && extra.cpf) clienteCpf = extra.cpf;
      if (!clienteEmail && extra.email) clienteEmail = extra.email;
      if (!clienteEstadoCivil && extra.estado_civil) clienteEstadoCivil = extra.estado_civil;
      if (!clienteEndereco && extra.endereco) clienteEndereco = extra.endereco;
      if (!clienteNacionalidade && extra.nacionalidade) clienteNacionalidade = extra.nacionalidade;
      if (!partePassiva && extra.parte_passiva) partePassiva = extra.parte_passiva;
      if (!partePassivaCnpj && extra.parte_passiva_cnpj) partePassivaCnpj = extra.parte_passiva_cnpj;
      if (!classeAcao && extra.classe_acao) classeAcao = extra.classe_acao;
    }
  } catch { /* */ }

  const preferUf = input.uf || undefined;
  const data: RevogacaoPdfData = {
    comarca: input.comarca || (entering?.cidade ?? leaving.cidade) || preferUf || 'Sao Paulo',
    dataExtenso: dataExtenso(),
    clienteNome: input.cliente,
    protocolo: input.protocolo,
    tribunal: input.tribunal || undefined,
    revogado: mapAdv(leaving, preferUf),
    substabelecido: entering ? mapAdv(entering, preferUf) : undefined,
    somenteRevogacao: input.somenteRevogacao,
    ultimoAdvogadoDetectado: input.ultimoAdvogadoDetectado || null,
    advogadosDjen: input.advogadosDjen || [],
    viabilidade: null,
    observacaoScanner: null,
    clienteCpf,
    clienteEmail,
    clienteEstadoCivil,
    clienteEndereco,
    clienteNacionalidade,
    partePassiva: input.incluirPartePassivaNoPdf ? partePassiva : null,
    partePassivaCnpj: input.incluirPartePassivaNoPdf ? partePassivaCnpj : null,
    classeAcao: input.incluirAcaoNoPdf ? classeAcao : null,
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
    const filenamePrefix = input.somenteRevogacao ? 'Revogacao' : 'Revogacao_Substabelecimento';
    return {
      success: true as const,
      base64,
      filename: `${filenamePrefix}_${safeClient}_${input.protocolo.replace(/\D/g, '').slice(0, 20)}.pdf`,
      mime: 'application/pdf',
      bytes: buf.length,
    };
  } catch (e: any) {
    console.error('[revogacao-pdf]', e);
    return { success: false as const, error: e?.message || 'Falha ao gerar PDF' };
  }
}
