/**
 * @fileOverview ScannerService v2.0 - Motor de Inteligência Resolutiva
 */

import { MNIClient } from './mni-client';
import { MovimentacaoAI, AIAnalysis } from './movimentacao-ai';
import { parseISO, isAfter, startOfDay } from 'date-fns';

export interface MNIProcessResult {
  cnj: string;
  statusUtil: string;
  ultimoEventoNome: string;
  dataEvento: string;
  necessitaRetorno: boolean;
  analysis: AIAnalysis;
}

export class ScannerService {
  private client: MNIClient;

  constructor() {
    // URL simulada para conformidade de interface
    this.client = new MNIClient('https://api.cnj.jus.br/intercomunicacao');
  }

  /**
   * Realiza a varredura de um processo comparando com o último retorno do cliente.
   */
  async scanProcessoInteligente(cnj: string, ultimoRetornoStr: string | null): Promise<MNIProcessResult | null> {
    const res = await this.client.consultarProcesso({
      idConsultante: 'LEXIS_MNI',
      senhaConsultante: 'TOKEN_MNI',
      numeroProcesso: cnj,
      incluirDocumentos: false
    });

    if (res.sucesso && res.processo && res.processo.movimentacoes) {
      const movimentacoes = [...res.processo.movimentacoes].sort((a, b) => 
        new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime()
      );

      const ultimaMov = movimentacoes[0];
      if (!ultimaMov) return null;

      // 1. Detecção de Encerramento em todo o histórico recente
      const encerramento = MovimentacaoAI.detectarEncerramento(movimentacoes.slice(0, 10));
      
      // 2. Comparação com Último Retorno ao Cliente
      let temNovoAndamento = false;
      if (ultimoRetornoStr) {
        try {
          const dataRetorno = startOfDay(parseISO(ultimoRetornoStr.split('/').reverse().join('-')));
          const dataMov = startOfDay(parseISO(ultimaMov.dataHora));
          temNovoAndamento = isAfter(dataMov, dataRetorno);
        } catch (e) {
          temNovoAndamento = true; 
        }
      } else {
        temNovoAndamento = true;
      }

      // 3. Classificação Neural
      const analysis = MovimentacaoAI.analisar(ultimaMov);

      // 4. Montagem do Resultado Útil
      let statusUtil = 'SEM NOVOS ANDAMENTOS';
      if (encerramento.encerrado) {
        statusUtil = 'PROCESSO ENCERRADO';
      } else if (temNovoAndamento) {
        statusUtil = 'HOUVE NOVO ANDAMENTO';
      }

      return {
        cnj: cnj,
        statusUtil: statusUtil,
        ultimoEventoNome: ultimaMov.descricao,
        dataEvento: ultimaMov.dataHora,
        necessitaRetorno: statusUtil !== 'SEM NOVOS ANDAMENTOS',
        analysis: analysis
      };
    }
    return null;
  }

  async scanLoteInteligente(casos: any[]) {
    const results: MNIProcessResult[] = [];
    const chunks = [];
    for (let i = 0; i < casos.length; i += 5) {
      chunks.push(casos.slice(i, i + 5));
    }

    for (const chunk of chunks) {
      const promises = chunk.map(c => this.scanProcessoInteligente(c.protocolo, c.ultimoRetorno));
      const chunkResults = await Promise.all(promises);
      results.push(...chunkResults.filter((r): r is MNIProcessResult => r !== null));
    }

    return results;
  }
}
