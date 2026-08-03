'use server';

import { fetchEsaJProcess } from '@/lib/esa-j-crawler';
import { captureProcessScreenshot } from '@/lib/process-screenshot';
import { getLinkGuiaJudicial } from '@/lib/guias-judiciais';

export async function enrichWithEsaJAction(cnj: string) {
  const data = await fetchEsaJProcess(cnj);
  return { success: !!data, data };
}

export async function captureScreenshotAction(cnj: string, url: string) {
  return await captureProcessScreenshot(cnj, url);
}

export async function getGuiaJudicialAction(cnj: string) {
  return getLinkGuiaJudicial(cnj);
}
