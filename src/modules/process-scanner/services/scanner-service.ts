/**
 * @fileOverview ScannerService v5.0 - Orquestrador de Providers Soberanos
 * Realiza a triagem cronológica utilizando a camada de Providers.
 */

import { IProcessProvider } from '../providers/BaseProvider';
import { TJProvider } from '../providers/TJProvider';
import { TRFProvider } from '../providers/TRFProvider';
import { CNJProvider } from '../providers/CNJProvider';
import { MovimentacaoAI, AIAnalysis } from './movimentacao-ai';
import { parseISO, isAfter, startOfDay, parse } from 'date-fns';

export const COURT_ALIASES: Record<string, string> = {
  "8.01": "tjac", "8.02": "tjal", "8.03": "tjap", "8.04": "tjam", "8.05": "tjba",
  "8.06": "tjce", "8.07": "tjdft", "8.08": "tjes", "8.09": "tjgo", "8.10": "tjma",
  "8.11": "tjmt", "8.12": "tjms", "8.13": "tjmg", "8.14": "tjpa", "8.15": "tjpb",
  "8.16": "tjpr", "8.17": "tjpe", "8.18": "tjpi", "8.19": "tjrj", "8.20": "tjrn",
  "8.21": "tjrs", "8.22": "tjro", "8.23": "tjrr", "8.24": "tjsc", "8.25": "tjse",
  "8.26": "tjsp", "8.27": "tjto", "4.01": "trf1", "4.02": "trf2", "4.03": "trf3",
  "4.04": "trf4", "4.05": "trf5", "4.06": "trf6"
};

export interface MNIProcessResult {
  cnj: string;
  statusUtil: string;
  ultimoEventoNome: string;
  dataEvento: string;
  necessitaRetorno: boolean;
  analysis: AIAnalysis;
  tribunal: string;
}

export class ScannerService {
  /**
   * Seleciona o Provider correto com base no CNJ
   */
  private getProvider(cnj: string): IProcessProvider {
    const clean = cnj.replace(/\D/g, '');
    const code = `${clean[13]}.${clean.substring(14, 16)}`;
    
    if (code.startsWith('8.')) return new TJProvider();
    if (code.startsWith('4.')) return new TRFProvider();
    
    return new CNJProvider();
  }

  /**
   * Auditoria Cronológica Absoluta via Provider
   */
  async scanProcesso(cnj: string, ultimoRetornoStr: string | null): Promise<MNIProcessResult | null> {
    const provider = this.getProvider(cnj);
    const processo = await provider.consultarProcesso(cnj);

    if (processo && processo.movimentacoes) {
      // 1. Ordenação Cronológica DESC (Mais recente primeiro)
      const movs = [...processo.movimentacoes].sort((a, b) => 
        new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime()
      );

      const ultimaMov = movs[0];
      if (!ultimaMov) return null;

      // 2. Classificação IA
      const analysis = MovimentacaoAI.analisar(ultimaMov);

      // 3. Detector de Novo Andamento
      let temNovo = false;
      const dataUltima = startOfDay(parseISO(ultimaMov.dataHora));
      
      if (ultimoRetornoStr && ultimoRetornoStr !== '-' && ultimoRetornoStr !== 'S/ Atendimento') {
        try {
          const dataRef = ultimoRetornoStr.includes('/') 
            ? parse(ultimoRetornoStr, 'dd/MM/yyyy', new Date())
            : parseISO(ultimoRetornoStr);
          temNovo = isAfter(dataUltima, startOfDay(dataRef));
        } catch { temNovo = true; }
      } else { temNovo = true; }

      let statusUtil = temNovo ? 'HOUVE NOVO ANDAMENTO' : 'SEM NOVOS ANDAMENTOS';
      if (analysis.categoria === 'ENCERRADO') statusUtil = 'PROCESSO ENCERRADO';

      return {
        cnj,
        statusUtil,
        ultimoEventoNome: ultimaMov.descricao.toUpperCase(),
        dataEvento: ultimaMov.dataHora,
        necessitaRetorno: statusUtil !== 'SEM NOVOS ANDAMENTOS',
        analysis,
        tribunal: processo.orgao || "TJ"
      };
    }

    return null;
  }

  async scanLoteInteligente(casos: any[]) {
    const results: MNIProcessResult[] = [];
    for (const c of casos) {
      const res = await this.scanProcesso(c.protocolo, c.ultimoRetorno);
      if (res) results.push(res);
    }
    return results;
  }
}
