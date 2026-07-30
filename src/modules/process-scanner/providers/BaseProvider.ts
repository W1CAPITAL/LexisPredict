/**
 * @fileOverview Interface Base para Providers de Tribunais v5.0
 * Define o contrato universal para obtenção de dados processuais.
 */

import { ProcessoStandard } from '../types/dto';

export interface IProcessProvider {
  consultarProcesso(cnj: string): Promise<ProcessoStandard | null>;
}

export abstract class BaseProvider implements IProcessProvider {
  abstract consultarProcesso(cnj: string): Promise<ProcessoStandard | null>;

  /**
   * Utilitário para normalizar o CNJ (remover máscara)
   */
  protected sanitizeCNJ(cnj: string): string {
    return cnj.replace(/\D/g, '');
  }
}
