
'use server';

import {
  SERIES_BACEN,
  taxaMediaMaisRecente,
  taxaMediaNaData,
  labelSerie,
} from '@/lib/bacen-sgs';

export async function fetchTaxaBacenAction(opts: {
  modalidade?: keyof typeof SERIES_BACEN;
  codigo?: number;
  dataContrato?: string;
}): Promise<{
  success: boolean;
  data?: string;
  valor?: number;
  codigo?: number;
  label?: string;
  error?: string;
}> {
  try {
    const codigo =
      opts.codigo ||
      SERIES_BACEN[opts.modalidade || 'VEICULOS_PF'] ||
      SERIES_BACEN.VEICULOS_PF;
    const hit = opts.dataContrato
      ? await taxaMediaNaData(codigo, opts.dataContrato)
      : await taxaMediaMaisRecente(codigo);
    if (!hit) return { success: false, error: 'Série vazia no Bacen' };
    return {
      success: true,
      data: hit.data,
      valor: hit.valor,
      codigo: hit.codigo,
      label: labelSerie(hit.codigo),
    };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Falha Bacen SGS' };
  }
}

export async function listSeriesBacenAction() {
  return Object.entries(SERIES_BACEN).map(([k, codigo]) => ({
    key: k,
    codigo,
    label: labelSerie(codigo),
  }));
}
