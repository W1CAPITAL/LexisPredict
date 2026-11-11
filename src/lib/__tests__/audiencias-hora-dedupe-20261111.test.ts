import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {extrairAudienciasOficiais} from '@/lib/audiencias-monitor';
import {compactarAudienciasVisiveis} from '@/lib/audiencias-compactar';

describe('Hermes audiências: formatos judiciais e deduplicação',()=>{
 it('extrai 16h:20min do despacho DJEN TJMG, sem converter para 16h00',()=>{
  const text='Intime-se as partes sobre designação de audiência de conciliação para o dia 22/01/2027 às 16h:20min., a se realizar no Centro Judiciário de Solução de Conflitos e Cidadania-CEJUSC, ATRAVÉS DE VIDEOCONFERÊNCIA.';
  const hearings=extrairAudienciasOficiais(text);
  expect(hearings).toEqual(expect.arrayContaining([
   expect.objectContaining({tipo:'conciliacao',data:'2027-01-22',hora:'16:20',modalidade:'virtual'})
  ]));
 });
 it.each([
  ['19/11/2026 às 13h00','13:00'],
  ['23/11/2026 às 10h:00min','10:00'],
  ['09/12/2026 às 10h20','10:20'],
  ['22/01/2027 às 16:20','16:20'],
  ['22/01/2027 às 16h:20min','16:20'],
 ])('interpreta horário de %s', (sample, expected)=>{
  const events=extrairAudienciasOficiais('Fica designada audiência de conciliação para o dia '+sample+'.');
  expect(events[0]?.hora).toBe(expected);
 });
 it('prefere publicação DJEN à notificação genérica quando CNJ, data e hora coincidem',()=>{
  const rows=[
   {id:184,processo_id:1110481,tipo:'audiencia',data_evento:'2027-01-22',hora_local:'16:20',situacao:'informada',fonte:'NOTIFICACAO'},
   {id:187,processo_id:1110481,tipo:'conciliacao',data_evento:'2027-01-22',hora_local:'16:20',situacao:'publicada',fonte:'DJEN'}
  ];
  expect(compactarAudienciasVisiveis(rows).map(x=>x.id)).toEqual([187]);
 });
 it('não confunde audiências diferentes no mesmo dia, com horários distintos',()=>{
  const rows=[
   {id:1,processo_id:2,tipo:'conciliacao',data_evento:'2026-11-23',hora_local:'09:00',situacao:'publicada',fonte:'DJEN'},
   {id:2,processo_id:2,tipo:'instrucao',data_evento:'2026-11-23',hora_local:'10:00',situacao:'publicada',fonte:'DJEN'}
  ];
  expect(compactarAudienciasVisiveis(rows)).toHaveLength(2);
 });
 it('omite pendência sem data quando já existe designação para mesmo processo/tipo',()=>{
  const rows=[
   {id:36,processo_id:242133,tipo:'conciliacao',data_evento:null,hora_local:null,situacao:'data_pendente',fonte:'DJEN'},
   {id:186,processo_id:242133,tipo:'conciliacao',data_evento:'2026-11-23',hora_local:'10:00',situacao:'informada',fonte:'NOTIFICACAO'}
  ];
  expect(compactarAudienciasVisiveis(rows).map(x=>x.id)).toEqual([186]);
 });
 it('todas as telas de agenda consomem a lista consolidada do mesmo endpoint',()=>{
  const api=readFileSync('src/app/api/audiencias/route.ts','utf8');
  const agenda=readFileSync('src/app/agenda/page.tsx','utf8');
  expect(api).toContain('compactarAudienciasVisiveis');
  expect(agenda).toContain('"/api/audiencias"');
 });
});
