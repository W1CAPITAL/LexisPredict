/**
 * @fileOverview ScannerService v3.0 - Motor de Inteligência Cronológica
 * Implementa ordenação rigorosa e comparação com último retorno.
 */

import { MNIClient } from './mni-client';
import { MovimentacaoAI, AIAnalysis } from './movimentacao-ai';
import { parseISO, isAfter, startOfDay, parse } from 'date-fns';

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
    this.client = new MNIClient('https://api.cnj.jus.br/intercomunicacao');
  }

  /**
   * Realiza a varredura atômica com ordenação decrescente de movimentações.
   */
  async scanProcessoInteligente(cnj: string, ultimoRetornoStr: string | null): Promise<MNIProcessResult | null> {
    const res = await this.client.consultarProcesso({
      idConsultante: 'LEXIS_MNI',
      senhaConsultante: 'TOKEN_MNI',
      numeroProcesso: cnj,
      incluirDocumentos: false
    });

    if (res.sucesso && res.processo && res.processo.movimentacoes) {
      // 1. Recuperar TODAS e Ordenar por Data/Hora DESC
      const movimentacoes = [...res.processo.movimentacoes].sort((a, b) => 
        new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime()
      );

      // 2. Considerar apenas a movimentação mais recente (pós-ordenação)
      const ultimaMov = movimentacoes[0];
      if (!ultimaMov) return null;

      // 3. Detecção de Encerramento (Soberana)
      const encerramento = MovimentacaoAI.detectarEncerramento(ultimaMov.descricao);
      
      // 4. Comparação com Último Retorno ao Cliente
      let temNovoAndamento = false;
      if (ultimoRetornoStr && ultimoRetornoStr !== '-' && ultimoRetornoStr !== 'S/ Atendimento') {
        try {
          // Normalização de data DD/MM/YYYY para comparação
          let dateObj;
          if (ultimoRetornoStr.includes('/')) {
            dateObj = parse(ultimoRetornoStr, 'dd/MM/yyyy', new Date());
          } else {
            dateObj = parseISO(ultimoRetornoStr);
          }
          
          const dataRetorno = startOfDay(dateObj);
          const dataMov = startOfDay(parseISO(ultimaMov.dataHora));
          
          temNovoAndamento = isAfter(dataMov, dataRetorno);
        } catch (e) {
          temNovoAndamento = true; 
        }
      } else {
        // Se nunca houve retorno, qualquer andamento é "Novo" para o operador
        temNovoAndamento = true;
      }

      // 5. Classificação Neural da Movimentação Recente
      const analysis = MovimentacaoAI.analisar(ultimaMov);

      // 6. Definição do Status de Utilidade
      let statusUtil = 'SEM NOVOS ANDAMENTOS';
      if (analysis.categoria === 'ENCERRADO') {
        statusUtil = 'PROCESSO ENCERRADO';
      } else if (temNovoAndamento) {
        statusUtil = 'HOUVE NOVO ANDAMENTO';
      }

      return {
        cnj: cnj,
        statusUtil: statusUtil,
        ultimoEventoNome: ultimaMov.descricao.toUpperCase(),
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
