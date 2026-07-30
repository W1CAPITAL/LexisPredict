/**
 * @fileOverview Motor de Consolidação Híbrida v8.0 (OMNI-SCANNER)
 * Unifica fontes MNI (Intercomunicação) e DataJud Público para auditoria processual.
 * @copyright 2026 W1 Capital | Fundador: Davi Alves Figueredo
 */

import { IProcessProvider, ProviderResponse } from '../providers/BaseProvider';
import { TJProvider } from '../providers/TJProvider';
import { TRFProvider } from '../providers/TRFProvider';
import { CNJProvider } from '../providers/CNJProvider';
import { MovimentacaoAI, AIAnalysis } from './movimentacao-ai';
import { fetchDataJud } from '@/lib/datajud';
import { parseISO, differenceInDays, startOfDay } from 'date-fns';

export interface AuditResult {
  cnj: string;
  localizado: boolean;
  tribunal: string;
  dataAuditoria: string;
  dataUltimoEvento: string | null;
  diasSemMovimentacao: number;
  mudancaDetectada: boolean;
  statusAuditoria: string;
  analysis: AIAnalysis;
  hash: string;
  metadata: {
    classe?: string;
    assunto?: string;
    orgao?: string;
    ultimaAtualizacao?: string;
  };
  debug: {
    latency: number;
    httpStatus: number;
    endpoint: string;
    source: 'MNI' | 'DATAJUD' | 'HYBRID';
    error?: string;
  };
}

export class ScannerService {
  private getProvider(cnj: string): IProcessProvider {
    const clean = cnj.replace(/\D/g, '');
    const code = `${clean[13]}.${clean.substring(14, 16)}`;
    if (code.startsWith('8.')) return new TJProvider();
    if (code.startsWith('4.')) return new TRFProvider();
    return new CNJProvider();
  }

  private generateHash(text: string, date: string): string {
    const raw = `${text}|${date}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const char = raw.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Realiza a auditoria consolidando dados do MNI e do DataJud Público.
   */
  async auditarProcesso(cnj: string, lastAuditHash?: string | null): Promise<AuditResult> {
    const provider = this.getProvider(cnj);
    const startTime = Date.now();
    const now = new Date();
    
    let resMNI: ProviderResponse | null = null;
    let resPublic: any = null;

    // 1. Consulta Concorrente (Resiliência)
    try {
      [resMNI, resPublic] = await Promise.all([
        provider.consultarProcesso(cnj).catch(() => null),
        fetchDataJud(cnj, 1, { fast: true, timeoutMs: 20000 }).catch(() => null)
      ]);
    } catch (e) {
      console.warn("[Consolidador] Falha na consulta concorrente");
    }

    // 2. Motor de Consolidação de Dados
    const localizado = !!(resMNI?.processo || (resPublic && !resPublic.error && resPublic.movimentos?.length > 0));
    
    if (!localizado) {
      return this.buildFailureResult(cnj, resMNI, resPublic);
    }

    // Unificação de Movimentações (MNI + Public)
    const movsMNI = resMNI?.processo?.movimentos || [];
    const movsPublic = resPublic?.movimentos?.map((m: any) => ({
      codigo: m.codigo || "0",
      descricao: m.nome || m.descricao,
      dataHora: m.dataHora
    })) || [];

    // Deduplicação por data/hora e descrição básica para evitar ruído no merge
    const allMovsMap = new Map();
    [...movsMNI, ...movsPublic].forEach(m => {
      const key = `${m.dataHora}|${m.descricao.substring(0, 30).toUpperCase()}`;
      if (!allMovsMap.has(key)) allMovsMap.set(key, m);
    });

    // Ordenação Cronológica DESC (Mais recente primeiro)
    const sortedMovs = Array.from(allMovsMap.values()).sort((a, b) => 
      new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime()
    );

    const ultimaMov = sortedMovs[0];
    const currentHash = this.generateHash(ultimaMov.descricao, ultimaMov.dataHora);
    const daysIdle = differenceInDays(startOfDay(now), startOfDay(parseISO(ultimaMov.dataHora)));
    
    const analysis = MovimentacaoAI.analisar(ultimaMov);
    const changeDetected = lastAuditHash !== currentHash;

    // 3. Enriquecimento de Metadados
    const tribunal = resPublic?.tribunal || resMNI?.processo?.orgao || "TJ";
    const metadata = {
      classe: resPublic?.classe || resMNI?.processo?.classe || 'N/A',
      assunto: (resPublic?.assunto || resMNI?.processo?.assunto || []).toString(),
      orgao: resPublic?.tribunal || resMNI?.processo?.orgao || 'N/A',
      ultimaAtualizacao: now.toISOString()
    };

    return {
      cnj,
      localizado: true,
      tribunal,
      dataAuditoria: now.toISOString(),
      dataUltimoEvento: ultimaMov.dataHora,
      diasSemMovimentacao: daysIdle,
      mudancaDetectada: changeDetected,
      statusAuditoria: changeDetected ? 'Mudança Detectada' : 'Sem Evidências de Alteração',
      analysis,
      hash: currentHash,
      metadata,
      debug: {
        latency: Date.now() - startTime,
        httpStatus: resPublic?.httpStatus || resMNI?.httpStatus || 200,
        endpoint: resPublic?.endpoint || resMNI?.endpoint || "CONSOLIDATED_API",
        source: (resMNI?.processo && resPublic?.movimentos) ? 'HYBRID' : (resMNI?.processo ? 'MNI' : 'DATAJUD')
      }
    };
  }

  private buildFailureResult(cnj: string, resMNI: any, resPublic: any): AuditResult {
    return {
      cnj,
      localizado: false,
      tribunal: "N/A",
      dataAuditoria: new Date().toISOString(),
      dataUltimoEvento: null,
      diasSemMovimentacao: 0,
      mudancaDetectada: false,
      statusAuditoria: 'Processo Não Localizado',
      analysis: MovimentacaoAI.analisar(null),
      hash: "",
      metadata: {},
      debug: {
        latency: 0,
        httpStatus: resPublic?.httpStatus || resMNI?.httpStatus || 404,
        endpoint: "ALL_SOURCES",
        source: 'HYBRID',
        error: resPublic?.message || resMNI?.error || "Nenhuma fonte retornou dados."
      }
    };
  }

  async scanLoteInteligente(casos: any[]) {
    const results: AuditResult[] = [];
    for (const c of casos) {
      const res = await this.auditarProcesso(c.protocolo, c.metadata?.hash);
      results.push(res);
    }
    return results;
  }
}
