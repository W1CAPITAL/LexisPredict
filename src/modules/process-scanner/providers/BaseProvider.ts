/**
 * @fileOverview Interface Base para Providers de Tribunais v6.0
 * Suporte a captura de metadados de depuração e resiliência.
 */

import { ProcessoStandard } from '../types/dto';

export interface ProviderResponse {
  processo: ProcessoStandard | null;
  latency: number;
  httpStatus: number;
  endpoint: string;
  error?: string;
}

export interface IProcessProvider {
  consultarProcesso(cnj: string): Promise<ProviderResponse>;
}

export abstract class BaseProvider implements IProcessProvider {
  abstract consultarProcesso(cnj: string): Promise<ProviderResponse>;

  protected sanitizeCNJ(cnj: string): string {
    return cnj.replace(/\D/g, '');
  }
}
