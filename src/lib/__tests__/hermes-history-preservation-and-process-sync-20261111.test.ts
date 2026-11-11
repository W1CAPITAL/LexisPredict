import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {mergeHermesCourtHistory,buildHermesVerifiedProcessPatch} from '@/lib/hermes-portfolio-evidence';
import type {HermesCourtEvent} from '@/lib/hermes-return-policy';
const event=(source:HermesCourtEvent['source'],at:string,text:string,url:string|null=null):HermesCourtEvent=>({source,at,text,url});
const checkedAt='2026-11-11T11:10:00Z';

describe('Hermes: histórico judicial nunca se perde após falhas de fonte',()=>{
 it('mantém movimentos DataJud de consultas anteriores quando só o DJEN respondeu',()=>{
  const before=[event('DataJud','2026-11-09','Julgado parcialmente procedente o pedido')];
  const now=[event('DJEN','2026-11-11','Publicação da intimação')];
  const merged=mergeHermesCourtHistory(before,now);
  expect(merged).toHaveLength(2);
  expect(merged.map(e=>e.source)).toEqual(['DJEN','DataJud']);
 });
 it('deduplica por fonte, data e texto, preservando link oficial anterior',()=>{
  const old=event('DJEN','2026-10-20','Publicação de acórdão', 'https://comunica.pje.jus.br/exemplo');
  const fresh=event('DJEN','2026-10-20','Publicação   de acórdão');
  const merged=mergeHermesCourtHistory([old],[fresh]);
  expect(merged).toHaveLength(1);
  expect(merged[0].url).toBe('https://comunica.pje.jus.br/exemplo');
 });
 it('mantém ao menos um movimento antigo mesmo com centenas de novas publicações',()=>{
  const datajud=event('DataJud','2025-01-01','Movimento de julgamento');
  const many=Array.from({length:180},(_,i)=>event('DJEN','2026-11-11','Comunicado número '+i));
  const merged=mergeHermesCourtHistory([datajud],many);
  expect(merged).toHaveLength(120);
  expect(merged.some(e=>e.source==='DataJud')).toBe(true);
 });
 it('descarta datas inválidas e não permite URL externa como fonte oficial',()=>{
  const merged=mergeHermesCourtHistory([],[event('DJEN','2026-13-99','Inválido'),event('DataJud','2026-11-10','Movimento', 'https://evil.example/x')]);
  expect(merged).toHaveLength(1);
  expect(merged[0].url).toBeNull();
 });
 it('atualiza movimentação no CRM somente quando DataJud confirmar evento mais recente',()=>{
  const patch=buildHermesVerifiedProcessPatch({
    checkedAt,lastDataJudMovement:'2026-11-05T12:00:00Z',lastMovement:'2026-11-06',lastDjenPublication:'2026-10-01',
    snapshot:{datajudOk:true,djenOk:false,events:[event('DataJud','2026-11-10','Julgado parcialmente procedente')]}
  });
  expect(patch.datajud_last_ok).toBe(true);
  expect(patch.ultima_movimentacao).toBe('2026-11-10');
  expect(patch.datajud_ultimo_nome).toContain('parcialmente procedente');
  expect(patch.datajud_ultimo_movimento).toContain('2026-11-10');
  expect(patch).not.toHaveProperty('proximo_retorno');
  expect(patch).not.toHaveProperty('status');
 });
 it('falha DataJud não apaga movimentação nem derruba flags já registradas',()=>{
  const patch=buildHermesVerifiedProcessPatch({
    checkedAt,lastDataJudMovement:'2026-11-10T12:00:00Z',lastMovement:'2026-11-10',lastDjenPublication:'2026-11-05',
    snapshot:{datajudOk:false,djenOk:true,events:[event('DJEN','2026-11-11','Publicação recente')]}
  });
  expect(patch).not.toHaveProperty('datajud_last_ok');
  expect(patch).not.toHaveProperty('ultima_movimentacao');
  expect(patch.djen_ultima_data).toBe('2026-11-11');
  expect(patch.djen_last_ok).toBe(true);
 });
 it('movimento antigo não regride campo de último andamento do tribunal',()=>{
  const patch=buildHermesVerifiedProcessPatch({
    checkedAt,lastDataJudMovement:'2026-11-10T12:00:00Z',lastMovement:'2026-11-10',lastDjenPublication:null,
    snapshot:{datajudOk:true,djenOk:false,events:[event('DataJud','2026-09-08','Movimento de despacho')]}
  });
  expect(patch).not.toHaveProperty('ultima_movimentacao');
  expect(patch).not.toHaveProperty('datajud_ultimo_movimento');
  expect(patch.datajud_last_ok).toBe(true);
 });
 it('liga a política de preservação à persistência real, com empresa no filtro',()=>{
  const src=readFileSync('src/lib/hermes-return-service.ts','utf8');
  expect(src).toContain('mergeHermesCourtHistory');
  expect(src).toContain('buildHermesVerifiedProcessPatch');
  expect(src).toContain(".from('hermes_portfolio_scans')");
  expect(src).toContain(".eq('empresa_id',row.empresa_id)");
  expect(src).toContain(".from('processos').update(");
  expect(src).not.toContain('sendWhatsApp');
 });
});
