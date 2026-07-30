/**
 * @fileOverview Motor de Consolidação Híbrida v12.0
 * PRIORIDADE DATAJUD-FIRST: Resposta rápida garantida sem bloqueio pelo MNI.
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
    source: 'MNI' | 'DATAJUD' | 'HYBRID' | 'FALLBACK';
    error?: string;
  };
}

export class ScannerService {
  
  private getProvider(cnj: string): IProcessProvider {
    const clean = cnj.replace(/\D/g, '');
    const code = clean.length >= 16 ? `${clean[13]}.${clean.substring(14, 16)}` : "8.26";
    
    if (code.startsWith('8.')) return new TJProvider();
    if (code.startsWith('4.')) return new TRFProvider();
    return new CNJProvider();
  }

  private generateHash(text: string, date: string): string {
    const raw = `${text || ''}|${date || ''}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const char = raw.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Realiza a auditoria com prioridade absoluta para DataJud (API Pública).
   */
  async auditarProcesso(cnj: string, lastAuditHash?: string | null): Promise<AuditResult> {
    const globalStartTime = Date.now();
    const now = new Date();
    
    // Fallback de Tribunal baseado no CNJ caso a API não retorne o nome
    const cnjLimpo = cnj.replace(/\D/g, '');
    const tribunalCode = cnjLimpo.length >= 16 ? `${cnjLimpo[13]}.${cnjLimpo.substring(14, 16)}` : "N/A";

    console.log(`[SCANNER] [INIT] ${cnj} | Prioridade: DataJud`);

    // 1. TENTA DATAJUD (FONTE PRIMÁRIA VELOZ)
    const resPublic = await fetchDataJud(cnj, 1, { fast: true, timeoutMs: 15000 });
    
    let baseData = null;
    let sourceUsed: 'DATAJUD' | 'MNI' | 'FALLBACK' = 'DATAJUD';

    if (!resPublic.error && resPublic.movimentos && resPublic.movimentos.length > 0) {
      baseData = resPublic;
    } else {
      // 2. TENTA MNI APENAS SE DATAJUD FALHAR (FONTE SECUNDÁRIA)
      console.log(`[SCANNER] [FALLBACK] ${cnj} -> Tentando MNI`);
      const provider = this.getProvider(cnj);
      const resMNI = await provider.consultarProcesso(cnj).catch(() => null);
      
      if (resMNI?.processo) {
        baseData = {
          numeroProcesso: resMNI.processo.numero,
          classe: resMNI.processo.classe,
          tribunal: resMNI.processo.orgao || "TJ",
          movimentos: resMNI.processo.movimentos,
          latency: resMNI.latency,
          httpStatus: resMNI.httpStatus,
          endpoint: resMNI.endpoint
        };
        sourceUsed = 'MNI';
      }
    }

    const globalLatency = Date.now() - globalStartTime;

    if (!baseData) {
      return {
        cnj,
        localizado: false,
        tribunal: tribunalCode,
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
          endpoint: resPublic.endpoint || "N/A",
          source: 'FALLBACK',
          error: resPublic.message || "NOT_FOUND"
        }
      };
    }

    // Saneamento de Movimentações para evitar erros de undefined
    const movimentos = Array.isArray(baseData.movimentos) ? baseData.movimentos : [];
    const sortedMovs = [...movimentos].sort((a: any, b: any) => 
      new Date(b.dataHora || 0).getTime() - new Date(a.dataHora || 0).getTime()
    );

    const ultimaMov = sortedMovs[0] || { descricao: "SEM MOVIMENTAÇÃO", dataHora: now.toISOString() };
    const descUltima = String(ultimaMov.descricao || (ultimaMov as any).nome || "Sem descrição").toUpperCase();
    const dataUltima = ultimaMov.dataHora || now.toISOString();

    const currentHash = this.generateHash(descUltima, dataUltima);
    const daysIdle = dataUltima ? differenceInDays(startOfDay(now), startOfDay(parseISO(dataUltima))) : 0;
    
    const analysis = MovimentacaoAI.analisar(ultimaMov);
    const changeDetected = lastAuditHash && lastAuditHash !== currentHash;

    return {
      cnj,
      localizado: true,
      tribunal: baseData.tribunal || tribunalCode,
      dataAuditoria: now.toISOString(),
      dataUltimoEvento: dataUltima,
      diasSemMovimentacao: daysIdle,
      mudancaDetectada: !!changeDetected,
      statusAuditoria: changeDetected ? 'Mudança Detectada' : 'Sem Evidências de Alteração',
      analysis,
      hash: currentHash,
      metadata: {
        classe: baseData.classe || 'N/A',
        orgao: baseData.tribunal || 'N/A',
        ultimaAtualizacao: now.toISOString()
      },
      debug: {
        latency: globalLatency,
        httpStatus: baseData.httpStatus || 200,
        endpoint: baseData.endpoint || "API_JUD",
        source: sourceUsed
      }
    };
  }

  /**
   * Método Público de Compatibilidade.
   */
  async scanProcesso(cnj: string): Promise<AuditResult> {
    return this.auditarProcesso(cnj);
  }
}
