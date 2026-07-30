/**
 * @fileOverview Motor de Consolidação Híbrida v10.0 (COMPATIBILITY LAYER)
 * Unifica fontes MNI e DataJud preservando métodos públicos originais.
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
  
  /**
   * Watchdog Interno: Dispara log se a etapa demorar mais de 5 segundos.
   */
  private async runWithWatchdog<T>(name: string, promise: Promise<T>, timeoutMs = 5000): Promise<T> {
    const timer = setTimeout(() => {
      console.warn(`\n[WATCHDOG] Etapa travada: ${name} | Tempo: >${timeoutMs}ms`);
    }, timeoutMs);
    
    try {
      return await promise;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Timeout Atômico Individual de 20 segundos por processo.
   */
  private async withTimeout<T>(promise: Promise<T>, timeoutMs = 20000): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`TIMEOUT_20S`)), timeoutMs)
    );
    return Promise.race([promise, timeoutPromise]);
  }

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
   * Método Público de Compatibilidade
   * Delegado para o ProviderManager interno (auditarProcesso)
   */
  async scanProcesso(cnj: string, empresaId?: string): Promise<AuditResult> {
    console.log(`[MNI_COMPAT] Scan unitário solicitado: ${cnj}`);
    return this.auditarProcesso(cnj);
  }

  async auditarProcesso(cnj: string, lastAuditHash?: string | null): Promise<AuditResult> {
    const startTime = Date.now();
    const now = new Date();
    const provider = this.getProvider(cnj);

    let resMNI: ProviderResponse | null = null;
    let resPublic: any = null;

    try {
      await this.withTimeout(
        this.runWithWatchdog(`FETCH_HYBRID_${cnj}`, (async () => {
          // Rito ProviderManager: Tenta MNI -> Se falhar, complementa com DataJud
          resMNI = await provider.consultarProcesso(cnj).catch(() => ({ processo: null, httpStatus: 500, error: 'MNI_FAIL', latency: 0, endpoint: 'MNI' }));
          resPublic = await fetchDataJud(cnj, 1, { fast: true, timeoutMs: 15000 }).catch(() => ({ error: true, httpStatus: 500 }));
        })())
      );
    } catch (e: any) {
      return this.buildFailureResult(cnj, null, { message: e.message, httpStatus: 408 });
    }

    const localizado = !!(resMNI?.processo || (resPublic && !resPublic.error && resPublic.movimentos?.length > 0));
    
    if (!localizado) {
      return this.buildFailureResult(cnj, resMNI, resPublic);
    }

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
    const changeDetected = lastAuditHash !== currentHash;

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
        error: resPublic?.message || resMNI?.error || "Falha na triagem"
      }
    };
  }

  async scanLoteInteligente(casos: any[]): Promise<AuditResult[]> {
    const results: AuditResult[] = [];
    for (const c of casos) {
      try {
        const res = await this.auditarProcesso(c.protocolo, c.metadata?.hash);
        results.push(res);
      } catch (e) {}
    }
    return results;
  }
}
