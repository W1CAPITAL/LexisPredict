/**
 * @fileOverview Motor de Consolidação Híbrida v9.0 (DIAGNOSTICO PROFUNDO)
 * Unifica fontes MNI e DataJud com Watchdog de travamento e logs atômicos.
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
      console.warn(`[WATCHDOG] Verifique se a Promise está pendente ou se há erro de rede não capturado.`);
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
      setTimeout(() => reject(new Error(`TIMEOUT_20S: Operação excedeu o limite de segurança.`)), timeoutMs)
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

  async auditarProcesso(cnj: string, lastAuditHash?: string | null): Promise<AuditResult> {
    const startTime = Date.now();
    const now = new Date();
    
    console.log(`\nProvider escolhido para ${cnj}`);
    const provider = this.getProvider(cnj);

    let resMNI: ProviderResponse | null = null;
    let resPublic: any = null;

    try {
      console.log(`Iniciando consulta para ${cnj}`);
      
      // Execução com Watchdog (5s) e Timeout Global (20s)
      await this.withTimeout(
        this.runWithWatchdog(`FETCH_HYBRID_${cnj}`, (async () => {
          [resMNI, resPublic] = await Promise.all([
            provider.consultarProcesso(cnj).catch(e => ({ processo: null, httpStatus: 500, error: e.message, latency: 0, endpoint: 'MNI' })),
            fetchDataJud(cnj, 1, { fast: true, timeoutMs: 15000 }).catch(e => ({ error: true, message: e.message, httpStatus: 500 }))
          ]);
        })())
      );

      console.log(`Consulta finalizada para ${cnj}`);
    } catch (e: any) {
      console.error(`Falha na consulta para ${cnj}: ${e.message}`);
      return this.buildFailureResult(cnj, null, { message: e.message, httpStatus: 408 });
    }

    console.log(`Parser iniciado para ${cnj}`);
    const localizado = !!(resMNI?.processo || (resPublic && !resPublic.error && resPublic.movimentos?.length > 0));
    
    if (!localizado) {
      console.log(`Parser finalizado (Não Localizado) para ${cnj}`);
      return this.buildFailureResult(cnj, resMNI, resPublic);
    }

    const movsMNI = resMNI?.processo?.movimentos || [];
    const movsPublic = resPublic?.movimentos?.map((m: any) => ({
      codigo: m.codigo || "0",
      descricao: m.nome || m.descricao,
      dataHora: m.dataHora
    })) || [];

    const allMovsMap = new Map();
    [...movsMNI, ...movsPublic].forEach(m => {
      const key = `${m.dataHora}|${m.descricao.substring(0, 30).toUpperCase()}`;
      if (!allMovsMap.has(key)) allMovsMap.set(key, m);
    });

    const sortedMovs = Array.from(allMovsMap.values()).sort((a, b) => 
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

    console.log(`Parser finalizado com sucesso para ${cnj}`);

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
    let count = 1;
    for (const c of casos) {
      console.log(`\nProcesso ${count} iniciado: ${c.protocolo}`);
      try {
        const res = await this.auditarProcesso(c.protocolo, c.metadata?.hash);
        results.push(res);
        console.log(`Processo concluído: ${c.protocolo}`);
      } catch (e) {
        console.error(`Erro fatal no processo ${c.protocolo}:`, e);
      } finally {
        count++;
      }
    }
    return results;
  }
}
