import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanCnj, courtAlias, normalizeDataJud, normalizeDjen, mergeEvents } from './core.mjs';

test('aceita apenas CNJ de 20 digitos sem inventar correspondencia', () => {
  assert.equal(cleanCnj('1002159-81.2026.8.11.0105'), '10021598120268110105');
  assert.equal(cleanCnj('000000'), null);
});

test('mapeia tribunais dos processos citados', () => {
  assert.equal(courtAlias('10021598120268110105'), 'tjmt');
  assert.equal(courtAlias('10366215420258260114'), 'tjsp');
  assert.equal(courtAlias('00039610320248172218'), 'tjpe');
  assert.equal(courtAlias('30005544420268060028'), 'tjce');
});

test('DataJud so associa movimentos ao CNJ exato', () => {
  const payload = {hits:{hits:[
    {_source:{numeroProcesso:'00000000000000000000',movimentos:[{nome:'Nao deve aparecer'}]}},
    {_source:{numeroProcesso:'10021598120268110105',movimentos:[{nome:'Juntada de peticao',dataHora:'2026-11-18T12:00:00Z'}]}}
  ]}};
  const result = normalizeDataJud(payload,'10021598120268110105');
  assert.equal(result.found,true);
  assert.equal(result.events.length,1);
  assert.equal(result.events[0].title,'Juntada de peticao');
  assert.equal(result.latestDay,'2026-11-18');
});

test('HTTP nao verificado nao e confundido com nenhum andamento', () => {
  assert.throws(()=>normalizeDataJud({error:'429'},'10021598120268110105'),/invalid_datajud_payload/);
  assert.throws(()=>normalizeDjen({error:'403'},'10021598120268110105'),/invalid_djen_payload/);
});

test('DJEN filtra outro processo e preserva data da publicacao', () => {
  const result = normalizeDjen({items:[
    {numeroProcesso:'10366215420258260114',texto:'OUTRO'},
    {numeroProcesso:'10021598120268110105',texto:'Intimação para manifestação',dataDisponibilizacao:'2026-11-20'}
  ]},'10021598120268110105');
  assert.equal(result.events.length,1);
  assert.equal(result.latestDay,'2026-11-20');
});

test('mescla provas sem perder historico salvo em falha de rede', () => {
  const old=[{id:'dj-a',source:'DataJud',date:'2026-11-01',title:'Movimento antigo'}];
  const merged=mergeEvents(old,[],[],100);
  assert.deepEqual(merged,old);
  assert.equal(mergeEvents(old,old,[],100).length,1);
  const legacy=[{at:'2026-11-02',text:'Intimação anterior',source:'DJEN',url:null}];
  assert.deepEqual(mergeEvents(legacy,[],[],100),legacy);
  const again=mergeEvents(legacy,[],legacy,100);
  assert.equal(again.length,1);
});
