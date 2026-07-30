/**
 * @fileOverview ScannerService v4.0 - Motor de Auditoria Cronológica Absoluta
 * Implementa rito de auditoria 360º para 100% das movimentações MNI.
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
   * Realiza a varredura atômica auditando 100% das movimentações.
   */
  async scanProcessoInteligente(cnj: string, ultimoRetornoStr: string | null): Promise<MNIProcessResult | null> {
    console.log(`[AUDITORIA] Iniciando triagem CNJ: ${cnj}`);

    const res = await this.client.consultarProcesso({
      idConsultante: 'LEXIS_MNI',
      senhaConsultante: 'TOKEN_MNI',
      numeroProcesso: cnj,
      incluirDocumentos: false,
      incluirMovimentos: true,
      incluirCabecalho: true
    });

    if (res.sucesso && res.processo && res.processo.movimentacoes) {
      const rawMovs = res.processo.movimentacoes;
      const totalRecebido = rawMovs.length;

      // 1. Auditoria de Carga: Garantir que nada foi descartado por filtros
      // Nunca utilizar get(0), first() ou slice(0,1) na carga bruta.
      const todasMovimentacoes = [...rawMovs];
      
      // 2. Ordenação Ascendente (Rito de Auditoria: Antigo -> Novo)
      todasMovimentacoes.sort((a, b) => 
        new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime()
      );

      // 3. Identificação de Pontas Cronológicas
      const primeiraMov = todasMovimentacoes[0];
      // A última movimentação é SEMPRE o último índice do array ordenado ascendente.
      const ultimaMov = todasMovimentacoes[todasMovimentacoes.length - 1];

      if (!ultimaMov) {
        console.warn(`[AUDITORIA] Processo ${cnj} retornou array vazio de movimentações.`);
        return null;
      }

      // 4. Relatório de Auditoria em Log
      console.log(`[RELATÓRIO MNI] Processo: ${cnj}
      - Movimentações retornadas: ${totalRecebido}
      - Movimentações interpretadas: ${todasMovimentacoes.length}
      - Movimentações descartadas: 0 (Carga 100% confirmada)
      - Primeira: ${primeiraMov.dataHora} | ${primeiraMov.descricao.substring(0, 30)}
      - Última: ${ultimaMov.dataHora} | ${ultimaMov.descricao.toUpperCase()}`);

      // 5. Comparação de Datas (Novo Andamento)
      let temNovoAndamento = false;
      const dataUltimaTribunal = startOfDay(parseISO(ultimaMov.dataHora));

      if (ultimoRetornoStr && ultimoRetornoStr !== '-' && ultimoRetornoStr !== 'S/ Atendimento') {
        try {
          let dataRef;
          if (ultimoRetornoStr.includes('/')) {
            dataRef = parse(ultimoRetornoStr, 'dd/MM/yyyy', new Date());
          } else {
            dataRef = parseISO(ultimoRetornoStr);
          }
          
          const dataUltimoRetorno = startOfDay(dataRef);
          // Detector de Novo Andamento: Data Tribunal > Último Retorno
          temNovoAndamento = isAfter(dataUltimaTribunal, dataUltimoRetorno);
        } catch (e) {
          temNovoAndamento = true; 
        }
      } else {
        temNovoAndamento = true;
      }

      // 6. Classificação Neural via MovimentacaoAI
      const analysis = MovimentacaoAI.analisar(ultimaMov);

      // 7. Consolidação de Resultado
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

    console.error(`[AUDITORIA] Falha na consulta do processo ${cnj}: ${res.mensagem}`);
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
