/**
 * @fileOverview Motor de Consolidação Híbrida v11.0
 * Unificação definitiva de fontes com latência real e logs de auditoria.
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
    if (clean.length < 16) return new CNJProvider();
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
   * Realiza a auditoria consolidada (DataJud + MNI).
   */
  async auditarProcesso(cnj: string, lastAuditHash?: string | null): Promise<AuditResult> {
    const globalStartTime = Date.now();
    const now = new Date();
    const provider = this.getProvider(cnj);

    console.log(`[SCANNER] [START] Processando CNJ: ${cnj}`);

    // 1. Consulta DataJud (Fonte Principal)
    const resPublic = await fetchDataJud(cnj, 1, { fast: true, timeoutMs: 20000 });
    
    // 2. Consulta MNI (Fonte Secundária/Auxiliar)
    let resMNI: ProviderResponse | null = null;
    if (resPublic.error || resPublic.message === 'NOT_FOUND') {
       resMNI = await provider.consultarProcesso(cnj).catch(() => null);
    }

    const globalLatency = Date.now() - globalStartTime;

    const localizado = !!((resPublic && !resPublic.error && resPublic.movimentos?.length > 0) || resMNI?.processo);
    
    if (!localizado) {
      console.warn(`[SCANNER] [NOT_FOUND] ${cnj} | Total Time: ${globalLatency}ms`);
      return {
        cnj,
        localizado: false,
        tribunal: resPublic.tribunal || "N/A",
        dataAuditoria: now.toISOString(),
        dataUltimoEvento: null,
        diasSemMovimentacao: 0,
        mudancaDetectada: false,
        statusAuditoria: 'Processo Não Localizado',
        analysis: MovimentacaoAI.analisar(null),
        hash: "",
        metadata: {},
        debug: {
          latency: globalLatency,
          httpStatus: resPublic.httpStatus || 404,
          endpoint: resPublic.endpoint || "CNJ_API",
          source: 'DATAJUD',
          error: resPublic.message || "NOT_FOUND"
        }
      };
    }

    // Consolidação de Movimentações
    const movsMNI = resMNI?.processo?.movimentos || [];
    const movsPublic = resPublic?.movimentos?.map((m: any) => ({
      codigo: m.codigo || "0",
      descricao: m.nome || m.descricao,
      dataHora: m.dataHora
    })) || [];

    const allMovsMap = new Map();
    [...movsMNI, ...movsPublic].forEach((m: any) => {
      const key = `${m.dataHora}|${m.descricao.substring(0, 30).toUpperCase()}`;
      if (!allMovsMap.has(key)) allMovsMap.set(key, m);
    });

    const sortedMovs = Array.from(allMovsMap.values()).sort((a: any, b: any) => 
      new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime()
    );

    const ultimaMov = sortedMovs[0];
    const currentHash = this.generateHash(ultimaMov.descricao, ultimaMov.dataHora);
    const daysIdle = differenceInDays(startOfDay(now), startOfDay(parseISO(ultimaMov.dataHora)));
    
    const analysis = MovimentacaoAI.analisar(ultimaMov);
    const changeDetected = lastAuditHash && lastAuditHash !== currentHash;

    console.log(`[SCANNER] [SUCCESS] ${cnj} | Category: ${analysis.categoria} | Change: ${changeDetected}`);

    return {
      cnj,
      localizado: true,
      tribunal: resPublic.tribunal || resMNI?.processo?.orgao || "TJ",
      dataAuditoria: now.toISOString(),
      dataUltimoEvento: ultimaMov.dataHora,
      diasSemMovimentacao: daysIdle,
      mudancaDetectada: !!changeDetected,
      statusAuditoria: changeDetected ? 'Mudança Detectada' : 'Sem Evidências de Alteração',
      analysis,
      hash: currentHash,
      metadata: {
        classe: resPublic.classe || resMNI?.processo?.classe || 'N/A',
        orgao: resPublic.tribunal || resMNI?.processo?.orgao || 'N/A',
        ultimaAtualizacao: now.toISOString()
      },
      debug: {
        latency: globalLatency,
        httpStatus: resPublic.httpStatus || 200,
        endpoint: resPublic.endpoint || "DATAJUD_API",
        source: resMNI?.processo ? 'HYBRID' : 'DATAJUD'
      }
    };
  }

  /**
   * Método Público de Compatibilidade para chamadas individuais.
   */
  async scanProcesso(cnj: string): Promise<AuditResult> {
    return this.auditarProcesso(cnj);
  }
}
