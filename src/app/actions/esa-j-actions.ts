'use server';

import { fetchEsaJProcess } from '@/lib/esa-j-crawler';
import { captureProcessScreenshot } from '@/lib/process-screenshot';
import { getTribunalFromCnj } from '@/lib/tribunais-cnj';

export async function enrichWithEsaJAction(cnj: string) {
  const data = await fetchEsaJProcess(cnj);
  return { 
    success: !!data, 
    data, 
    note: data ? "Enriquecido via e-SAJ" : "Tribunal não suportado para deep-crawl (use DataJud)" 
  };
}

export async function captureScreenshotAction(cnj: string, url: string) {
  return await captureProcessScreenshot(cnj, url);
}

export async function getConsultaUrlAction(cnj: string) {
  const tribunal = getTribunalFromCnj(cnj);
  if (!tribunal) return null;
  return {
    url: tribunal.consultaUrl(cnj),
    nome: tribunal.nome,
    sistema: tribunal.sistema,
  };
}

export async function getGuiaJudicialAction(cnj: string) {
  const tribunal = getTribunalFromCnj(cnj);
  if (!tribunal) {
    return { url: "https://www.cnj.jus.br", instrucao: "Tribunal não mapeado" };
  }
  return {
    url: tribunal.consultaUrl(cnj),
    tribunal: tribunal.nome,
    instrucao: `Acesse o portal do ${tribunal.nome}, consulte o processo e procure a opção “Emitir Guia / Custas / GRJ”.`,
  };
}
