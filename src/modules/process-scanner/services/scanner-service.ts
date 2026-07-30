/**
 * @fileOverview ScannerService - Motor de Monitoramento em Lote
 */

import { MNIClient } from './mni-client';
import { MovimentacaoAI } from './movimentacao-ai';
import { supabase } from '@/lib/supabase'; // Apenas para conexão, tabelas novas

export class ScannerService {
  private client: MNIClient;

  constructor() {
    this.client = new MNIClient('https://api.cnj.jus.br/intercomunicacao');
  }

  async scanProcesso(cnj: string, empresaId: string) {
    const res = await this.client.consultarProcesso({
      idConsultante: 'LEXIS_MNI',
      senhaConsultante: 'TOKEN_MNI',
      numeroProcesso: cnj,
      incluirDocumentos: false
    });

    if (res.sucesso && res.processo) {
      return await this.detectarMudancas(res.processo, empresaId);
    }
    return null;
  }

  async scanLote(cnjs: string[], empresaId: string) {
    const results = [];
    // Processamento paralelo limitado (Concurrency 5 para segurança)
    const chunks = [];
    for (let i = 0; i < cnjs.length; i += 5) {
      chunks.push(cnjs.slice(i, i + 5));
    }

    for (const chunk of chunks) {
      const p = chunk.map(cnj => this.scanProcesso(cnj, empresaId));
      results.push(...(await Promise.all(p)));
    }
    return results;
  }

  private async detectarMudancas(processo: any, empresaId: string) {
    // 1. Comparar com process_history para evitar duplicatas
    const lastMov = processo.movimentacoes[0];
    if (!lastMov) return null;

    const analysis = MovimentacaoAI.analisar(lastMov);
    
    // 2. Gravar no histórico se houver novidade
    // Aqui usaria supabase.from('process_history').insert(...)
    
    return {
      cnj: processo.numeroUnico.numero,
      analysis,
      lastMov: lastMov.descricao
    };
  }
}
