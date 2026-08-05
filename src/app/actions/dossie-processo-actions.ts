'use server';

/**
 * Gera dossiê PDF de um processo (DataJud + DJEN + flags + Claude opcional).
 */
import React from 'react';
import { getUserContext, getStoredCasesForEmpresa } from '@/lib/server-db';
import { isAudienciaReal } from '@/lib/audiencia-detect';
import type { DossieProcessoData } from '@/components/pdf/dossie-processo-pdf';

function diasSemRetorno(ultimo?: string | null): number | null {
  if (!ultimo?.trim()) return null;
  try {
    const raw = ultimo.trim();
    const d = new Date(
      raw.includes('/') ? raw.split('/').reverse().join('-') : raw
    );
    if (Number.isNaN(d.getTime())) return null;
    return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
  } catch {
    return null;
  }
}

function baRelacionadaAoProcesso(c: any): boolean {
  if (!c?.indicio_busca_apreensao && c?.evento_tipo !== 'ba' && !c?.ba_tipo)
    return false;
  // Relação: mesmo CNJ no motivo, ou flag operacional sem geo distante extremo
  const motivo = String(c.busca_apreensao_motivo || c.evento_resumo || '').toUpperCase();
  const dig = String(c.protocolo || '').replace(/\D/g, '');
  if (dig.length >= 15 && motivo.replace(/\D/g, '').includes(dig.slice(0, 15)))
    return true;
  if (c.ba_geo_distante && c.ba_alertar_operacional === false) return false;
  // penhora/BA genérica só se não for geo distante
  return !c.ba_geo_distante;
}

function penhoraRelacionada(c: any): boolean {
  const t = String(c.ba_tipo || c.evento_resumo || c.datajud_ultimo_nome || '').toUpperCase();
  if (!/PENHORA/.test(t)) return false;
  return baRelacionadaAoProcesso({ ...c, indicio_busca_apreensao: true });
}

export async function generateDossieProcessoPDFAction(protocolo: string, opts?: {
  useClaude?: boolean;
  movimentos?: any[];
  comunicacoes?: any[];
}) {
  try {
    const { empresa_id } = await getUserContext();
    if (!empresa_id) return { success: false as const, error: 'Sessão expirada.' };
    if (!protocolo) return { success: false as const, error: 'Protocolo obrigatório.' };

    const cases = await getStoredCasesForEmpresa(empresa_id);
    const c = (cases || []).find(
      (x: any) => x.protocolo === protocolo || x.protocolo_ref === protocolo
    );
    if (!c) return { success: false as const, error: 'Processo não encontrado na carteira.' };

    const textoAudiencia = `${c.evento_resumo || ''} ${c.datajud_ultimo_nome || ''} ${c.djen_ultimo_resumo || ''}`;
    const audienciaOk = isAudienciaReal(textoAudiencia);

    let analiseClaude: string | null = null;
    if (opts?.useClaude) {
      try {
        const { runCascade } = await import('@/lib/ai/cascade');
        const blob = [
          `CNJ ${c.protocolo} cliente ${c.cliente}`,
          `DataJud: ${c.datajud_ultimo_nome || ''} ${c.datajud_ultimo_movimento || ''}`,
          `DJEN: ${c.djen_ultimo_resumo || ''}`,
          `Obs: ${(c.observacao || '').slice(0, 400)}`,
        ].join('\n');
        const r = await runCascade({
          preferred: 'claude',
          surface: 'scan',
          system:
            'Você é analista de gabinete. Em 5-8 linhas, em português, resuma risco operacional, se há audiência DESIGNADA (não mera menção), custas, BA só se vinculada ao CNJ, e próximo passo interno. Sem inventar valores nem resultados de mérito.',
          messages: [{ role: 'user', content: blob }],
          max_tokens: 400,
          temperature: 0.2,
        });
        analiseClaude = r.text?.slice(0, 1200) || null;
      } catch (e: any) {
        analiseClaude = `Claude indisponível: ${e?.message || e}`;
      }
    }

    const data: DossieProcessoData = {
      geradoEm: new Date().toLocaleString('pt-BR'),
      cliente: c.cliente || 'NÃO IDENTIFICADO',
      protocolo: c.protocolo,
      tribunal: c.tribunal,
      advogado: c.advogado,
      escritorio: c.escritorio,
      telefone: c.telefone,
      status: c.status,
      ultimoRetorno: c.ultimoRetorno,
      proximoPrazo: c.proximoPrazo,
      observacao: c.observacao,
      datajudUltimo: c.datajud_ultimo_movimento,
      datajudNome: c.datajud_ultimo_nome,
      djenResumo: c.djen_ultimo_resumo,
      djenLink: c.djen_ultimo_link,
      flags: {
        novidade: !!(c.tem_novo_andamento || c.tem_atualizacao_pos_retorno || c.djen_nova_comunicacao),
        baixa: !!c.datajud_encerrado_tribunal,
        ba: !!(c.indicio_busca_apreensao || c.evento_tipo === 'ba'),
        baTipo: c.ba_tipo || null,
        baRelacionada: baRelacionadaAoProcesso(c),
        penhora: /PENHORA/i.test(String(c.ba_tipo || c.evento_resumo || '')),
        penhoraRelacionada: penhoraRelacionada(c),
        audiencia: audienciaOk,
        cumprimento: !!c.em_cumprimento_sentenca,
        custas: !!(c as any).tem_custas || c.evento_tipo === 'custas',
        procedente: c.evento_tipo === 'sentenca_procedente',
        improcedente: c.evento_tipo === 'sentenca_improcedente',
      },
      tempoRespostaDias: diasSemRetorno(c.ultimoRetorno),
      analiseClaude,
      movimentos: (opts?.movimentos || []).slice(0, 12).map((m: any) => ({
        data: m.dataHora || m.data || m.date,
        nome: m.nome || m.descricao || m.title,
      })),
      comunicacoes: (opts?.comunicacoes || []).slice(0, 8).map((d: any) => ({
        data: d.data_disponibilizacao || d.data,
        resumo: (d.texto || d.resumo || '').replace(/<[^>]+>/g, '').slice(0, 200),
      })),
      narrativaOperacional:
        'Monitoramento contínuo DataJud/DJEN; alertas só com validação de vínculo; fila priorizada por criticidade; atendimento humano registra retorno e zera alerta.',
      narrativaCliente:
        'Cliente orientado em linguagem simples; sem promessa de resultado; prazos e guias confirmados internamente antes de cobrança ou orientação de pagamento.',
    };

    const { renderToBuffer } = await import('@react-pdf/renderer');
    const { DossieProcessoPDF } = await import('@/components/pdf/dossie-processo-pdf');
    const element = React.createElement(DossieProcessoPDF as any, { data }) as any;
    const buf = await renderToBuffer(element);
    return {
      success: true as const,
      base64: Buffer.from(buf).toString('base64'),
      filename: `dossie_${c.protocolo.replace(/[^\d]/g, '')}.pdf`,
    };
  } catch (e: any) {
    return { success: false as const, error: e?.message || 'Falha ao gerar dossiê.' };
  }
}
