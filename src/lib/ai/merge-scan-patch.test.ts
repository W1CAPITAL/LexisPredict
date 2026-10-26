import {describe,expect,it} from 'vitest';
import type {AiCaseClassification} from './case-event-classifier';
import {mergeAiIntoScanPatch} from './merge-scan-patch';

const flags:AiCaseClassification['flags']={
 encerrado:true,cumprimento_sentenca:true,procedente:true,improcedente:false,
 parcial:false,liminar:false,busca_apreensao:true,ba_tipo:'VEICULO',
 cancelamento_distribuicao:true,novo_relevante:true,audiencia:true,custas:true,
};
const classification:AiCaseClassification={
 evento_tipo:'transito_ou_baixa',
 evento_resumo:'Sentença definitiva e baixa concluída',
 severidade:'critica',alertar:true,motivo_alerta:'Revisar decisão',flags,
 engine:'pollinations:openai',
};

describe('P0: AI is a suggestion, not a judicial source of truth',()=>{
 it('never invents an official baixa, cumprimento, BA or merit from AI alone',()=>{
  const original={datajud_encerrado_tribunal:false,em_cumprimento_sentenca:false,
   evento_tipo:'rotina',evento_resumo:'Movimento oficial DataJud',evento_fonte:'datajud',
   merito_resultado:null,indicio_busca_apreensao:false,tem_novo_andamento:false};
  const result=mergeAiIntoScanPatch(original,classification);
  expect(result.datajud_encerrado_tribunal).toBe(false);
  expect(result.em_cumprimento_sentenca).toBe(false);
  expect(result.indicio_busca_apreensao).toBe(false);
  expect(result.merito_resultado).toBeNull();
  expect(result.tem_novo_andamento).toBe(false);
  expect(result.evento_tipo).toBe('rotina');
  expect(result.evento_resumo).toBe('Movimento oficial DataJud');
  expect(result.evento_fonte).toBe('datajud');
  expect(result.sentenca_procedente).toBeUndefined();
  expect(result.ai_sugere_baixa).toBe(true);
  expect(result.ai_sugere_cumprimento).toBe(true);
  expect(result.ai_merito_sugerido).toBe('procedente');
  expect(result.ai_sugere_busca_apreensao).toBe(true);
  expect(result.precisa_revisar_encerramento).toBe(true);
  expect(result.ai_log_line).toContain('NÃO CONFIRMADO');
 });
 it('does not erase existing officially confirmed fields',()=>{
  const original={datajud_encerrado_tribunal:true,datajud_encerrado_motivo:'Baixa confirmada no tribunal',
   evento_tipo:'transito_ou_baixa',evento_resumo:'Baixa oficial',em_cumprimento_sentenca:true,
   merito_resultado:'parcial',indicio_busca_apreensao:true};
  const result=mergeAiIntoScanPatch(original,classification);
  expect(result.datajud_encerrado_tribunal).toBe(true);
  expect(result.datajud_encerrado_motivo).toBe('Baixa confirmada no tribunal');
  expect(result.evento_resumo).toBe('Baixa oficial');
  expect(result.em_cumprimento_sentenca).toBe(true);
  expect(result.merito_resultado).toBe('parcial');
  expect(result.indicio_busca_apreensao).toBe(true);
 });
 it('tutela indeferida cannot be turned into a confirmed closure',()=>{
  const result=mergeAiIntoScanPatch({datajud_encerrado_tribunal:false},
    {...classification,evento_tipo:'liminar',evento_resumo:'Tutela de urgência indeferida'});
  expect(result.datajud_encerrado_tribunal).toBe(false);
  expect(result.ai_sugere_baixa).toBeUndefined();
 });
});
