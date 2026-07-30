/**
 * @fileOverview Provider para API Pública DataJud (CNJ)
 */

import { BaseProvider } from './BaseProvider';
import { ProcessoStandard } from '../types/dto';
import { fetchDataJud } from '@/lib/datajud';

export class CNJProvider extends BaseProvider {
  async consultarProcesso(cnj: string): Promise<ProcessoStandard | null> {
    const data = await fetchDataJud(cnj, 1, { fast: true });
    
    if (!data || data.error || !data.movimentos) return null;

    // Parser Universal para ProcessoStandard
    return {
      numero: data.numeroProcesso,
      classe: data.classe,
      assunto: [], // Expandir conforme necessidade
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
    };
  }
}
