import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {summarizeHermesStalled} from '@/lib/hermes-stalled-ui';
import type {HermesStalledSummary} from '@/lib/hermes-company-service';

const make=(state:HermesStalledSummary['state'], overrides:Partial<HermesStalledSummary>={}):HermesStalledSummary=>({
  processId:1,client:'Cliente',cnj:'10012183620265020040',state,
  checkedAt:'2026-11-11T14:00:00Z',lastMovementAt:null,daysWithoutMovement:null,
  djenOk:false,datajudOk:false,sourceErrors:{},...overrides
});
describe('Processos parados: monitoramento automático Hermes',()=>{
 it('distingue estados verificados de estados parciais e indisponíveis',()=>{
   const summary=summarizeHermesStalled([
     make('confirmed_idle'),make('recent_movement'),make('partial'),make('unavailable'),
   ]);
   expect(summary).toEqual({total:4,confirmedIdle:1,recent:1,partial:1,unavailable:1});
 });
 it('nenhum processo lido significa nenhuma verificação, e não falsa ausência de movimentos',()=>{
   expect(summarizeHermesStalled([])).toEqual({total:0,confirmedIdle:0,recent:0,partial:0,unavailable:0});
 });
 it('status em andamento ou sem data não são contabilizados como confirmados',()=>{
   const summary=summarizeHermesStalled([make('scanning'),make('no_dated_movement')]);
   expect(summary.confirmedIdle).toBe(0);
   expect(summary.partial).toBe(0);
 });
 it('ação só acessa os dados do tenant autenticado, sem abrir service role no cliente',()=>{
   const action=readFileSync('src/app/actions/hermes-stalled-actions.ts','utf8');
   expect(action).toContain('getUserContext()');
   expect(action).toContain('ctx.empresa_id');
   expect(action).toContain('getHermesStalledSummaries(String(ctx.empresa_id))');
   expect(action).not.toContain('getSupabaseAdmin');
 });
 it('tela de parados incorpora painel automático com atualização periódica e dados oficiais separados',()=>{
   const page=readFileSync('src/app/processos-parados/page.tsx','utf8');
   const panel=readFileSync('src/components/hermes/hermes-stalled-inline.tsx','utf8');
   expect(page).toContain('<HermesStalledInline');
   expect(panel).toContain('getHermesStalledForParadosAction');
   expect(panel).toContain('90_000');
   expect(panel).toContain('Fonte DataJud');
   expect(panel).toContain('Fonte DJEN');
   expect(panel).toContain('Consulta parcial');
 });
});
