/**
 * @fileOverview Provider para API Pública DataJud (CNJ) v6.0
 */

import { BaseProvider, ProviderResponse } from './BaseProvider';
import { fetchDataJud } from '@/lib/datajud';

export class CNJProvider extends BaseProvider {
  async consultarProcesso(cnj: string): Promise<ProviderResponse> {
    // Timeout estrito de 20s para o scanner em lote
    const data = await fetchDataJud(cnj, 1, { fast: true, timeoutMs: 20000 });
    
    if (!data || data.error || !data.movimentos) {
      return {
        processo: null,
        latency: data?.latency || 0,
        httpStatus: data?.httpStatus || 500,
        endpoint: data?.endpoint || "N/A",
        error: data?.message || "Erro desconhecido"
      };
    }

    return {
      processo: {
        numero: data.numeroProcesso,
        classe: data.classe,
        assunto: [],
        orgao: data.tribunal,
        vara: "N/A",
        grau: "1",
        situacao: "EM ANDAMENTO",
        movimentos: data.movimentos.map((m: any) => ({
          codigo: m.codigo || "0",
          descricao: m.nome || m.descricao,
          dataHora: m.dataHora
        })),
        ultimaMovimentacao: "",
        ultimaAtualizacao: new Date().toISOString()
      },
      latency: data.latency || 0,
      httpStatus: data.httpStatus || 200,
      endpoint: data.endpoint || "N/A"
    };
  }
}
