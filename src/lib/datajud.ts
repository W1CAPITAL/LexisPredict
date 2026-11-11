/**
 * @fileOverview Serviço DataJud (CNJ) v480 — BOTH não sacrifica o tribunal
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import 'server-only';
import { perfCached, PerfKeys, perfLog, perfNow } from '@/lib/performance-motor';
import {resolveDataJudAlias} from '@/lib/datajud-aliases';
import {extrairPolos} from '@/lib/datajud-party';
import {isDataJudUseAuthorized} from '@/lib/datajud-policy';
import { resolveDataJudTimeoutMs } from '@/lib/datajud-time-budget';

export {COURT_ALIASES,resolveDataJudAlias} from '@/lib/datajud-aliases';
export {extrairPolos} from '@/lib/datajud-party';
export {isDataJudUseAuthorized} from '@/lib/datajud-policy';

/** Chave pública vigente publicada pelo CNJ. Ela pode ser rotacionada sem aviso. */
const DATAJUD_PUBLIC_KEY = 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==';
const DATAJUD_API_KEY = normalizeDataJudApiKey(process.env.DATAJUD_API_KEY || process.env.CNJ_API_KEY || '') || DATAJUD_PUBLIC_KEY;
let liveDataJudKey:{value:string;until:number}|null=null;

/** Normaliza tanto o valor bruto quanto o cabeçalho completo copiado da Wiki do CNJ. */
export function normalizeDataJudApiKey(value:unknown):string{
 return String(value||'').trim()
  .replace(/^Authorization\s*:\s*/i,'')
  .replace(/^APIKey\s+/i,'')
  .trim();
}

/** Extrai a chave pública atual do conteúdo oficial da Wiki do CNJ. */
export function extractDataJudPublicKey(page:string):string|null{
 const text=String(page||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/gi,' ');
 const match=text.match(/(?:Authorization\s*:\s*)?APIKey\s+([A-Za-z0-9_+/=-]{30,})/i);
 return match?.[1]||null;
}
