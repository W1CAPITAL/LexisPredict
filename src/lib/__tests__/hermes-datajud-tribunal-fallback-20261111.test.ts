import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolveHermesDataJudTimeoutMs} from '@/lib/hermes-datajud-time-policy';
import {getHermesNationalSourcePlan} from '@/lib/hermes-official-fallbacks';
const read=(p:string)=>readFileSync(p,'utf8');
describe('Hermes · limite de tempo e alternativas oficiais',()=>{
 it('consulta manual lenta tem janela maior que 60 segundos sem ampliar o cron',()=>{
   expect(resolveHermesDataJudTimeoutMs(true)).toBe(85_000);
   expect(resolveHermesDataJudTimeoutMs(false)).toBe(38_000);
 });
 it('diagnóstico tem tempo limitado e independe do ajuste manual',()=>{
   expect(resolveHermesDataJudTimeoutMs(true,25_000)).toBe(25_000);
   expect(resolveHermesDataJudTimeoutMs(false,5_000)).toBe(5_000);
   expect(resolveHermesDataJudTimeoutMs(true,999_999)).toBe(90_000);
   expect(resolveHermesDataJudTimeoutMs(true,-1)).toBe(85_000);
 });
 it('o Hermes usa política de timeout apenas depois da reserva do DataJud',()=>{
   const service=read('src/lib/hermes-return-service.ts');
   expect(service.indexOf('hermes_reserve_datajud_slot')).toBeLessThan(service.indexOf('resolveHermesDataJudTimeoutMs(manual,probeTimeoutMs)'));
   expect(service).toContain('cloudBudget: true');
 });
 it('o teto técnico permite 85s e a rota manual oferece margem sem alterar o lote automático',()=>{
   const datajud=read('src/lib/datajud.ts');
   const route=read('src/app/api/cron/hermes-returns/route.ts');
   expect(datajud).toContain('Math.min(95_000');
   expect(route).toContain('export const maxDuration = 140;');
   expect(route).toContain('runHermesPortfolioScanBatch');
 });
 it('TJPR SCMPP é alternativa formal documentada, mas não aparece como consulta ativa sem protocolo verificado',()=>{
   const plan=getHermesNationalSourcePlan('0068497-95.2026.8.16.0014');
   expect(plan?.tribunal).toBe('TJPR');
   expect(plan?.tribunalApiAutomated).toBe(false);
   expect(plan?.scmpp?.availability).toBe('not_verified');
   expect(plan?.scmpp?.wsdl).toBe('https://projudi.tjpr.jus.br/projudi_consulta/webservices/projudiIntercomunicacaoWebService222?wsdl');
 });
 it('o painel informa por que o tribunal ainda não respondeu automaticamente, sem confundir com DataJud',()=>{
   const ui=read('src/components/hermes/hermes-return-review-button.tsx');
   expect(ui).toContain('SCMPP · TJPR');
   expect(ui).toContain('integração ainda não validada');
 });
});
