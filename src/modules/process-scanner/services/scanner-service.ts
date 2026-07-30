/**
 * @fileOverview Motor de Auditoria Processual Inteligente v6.0
 * Realiza auditoria cronológica, hashing de integridade e análise de inércia.
 */

import { IProcessProvider } from '../providers/BaseProvider';
import { TJProvider } from '../providers/TJProvider';
import { TRFProvider } from '../providers/TRFProvider';
import { CNJProvider } from '../providers/CNJProvider';
import { MovimentacaoAI, AIAnalysis } from './movimentacao-ai';
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

  async auditarProcesso(cnj: string, lastAuditHash?: string | null): Promise<AuditResult> {
    const provider = this.getProvider(cnj);
    const processo = await provider.consultarProcesso(cnj);
    const now = new Date();

    if (!processo || !processo.movimentacoes || processo.movimentacoes.length === 0) {
      return {
        cnj,
        localizado: false,
        tribunal: "N/A",
        dataAuditoria: now.toISOString(),
        dataUltimoEvento: null,
        diasSemMovimentacao: 0,
        mudancaDetectada: false,
        statusAuditoria: 'Processo Não Localizado',
        analysis: MovimentacaoAI.analisar(null),
        hash: ""
      };
    }

    // Ordenação Cronológica ASC para auditoria de 100% dos dados
    const movs = [...processo.movimentacoes].sort((a, b) => 
      new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime()
    );

    const ultimaMov = movs[movs.length - 1];
    const currentHash = this.generateHash(ultimaMov.descricao, ultimaMov.dataHora);
    const daysIdle = differenceInDays(startOfDay(now), startOfDay(parseISO(ultimaMov.dataHora)));
    
    const analysis = MovimentacaoAI.analisar(ultimaMov);
    const changeDetected = lastAuditHash !== currentHash;

    return {
      cnj,
      localizado: true,
      tribunal: processo.orgao || "TJ",
      dataAuditoria: now.toISOString(),
      dataUltimoEvento: ultimaMov.dataHora,
      diasSemMovimentacao: daysIdle,
      mudancaDetectada: changeDetected,
      statusAuditoria: changeDetected ? 'Mudança Detectada' : 'Sem Evidências de Alteração',
      analysis,
      hash: currentHash
    };
  }

  async scanLoteInteligente(casos: any[]) {
    const results: AuditResult[] = [];
    for (const c of casos) {
      // Nota: o c.metadata?.hash virá do banco de dados salvo na auditoria anterior
      const res = await this.auditarProcesso(c.protocolo, c.metadata?.hash);
      if (res) results.push(res);
    }
    return results;
  }
}
