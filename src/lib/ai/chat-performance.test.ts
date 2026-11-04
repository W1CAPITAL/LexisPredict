import { describe, expect, it } from 'vitest';
import { planChatWork } from './chat-performance';

describe('Superagente — orçamento de tempo e evidência por intenção', () => {
 it('resumo curto de processo usa carteira autorizada, sem bloquear em consulta oficial ao vivo',()=>{
  const p=planChatWork('FALE SOBRE ESSE PROCESSO 8007617-77.2023.8.05.0154');
  expect(p.mode).toBe('case-summary');
  expect(p.liveJudicialLookup).toBe(false);
  expect(p.maxTokens).toBeLessThanOrEqual(1100);
  expect(p.needExtraResearch).toBe(false);
 });
 it('ordem explícita para atualizar movimentações consulta fonte externa',()=>{
  const p=planChatWork('Consulte o DJEN e atualize a última movimentação do processo 8007617-77.2023.8.05.0154');
  expect(p.liveJudicialLookup).toBe(true);
  expect(p.mode).toBe('deep');
 });
 it('dossiês e investigações mantêm análise completa e não cortam fundamentação',()=>{
  for(const prompt of ['Faça um dossiê completo do processo 8007617-77.2023.8.05.0154','Investigue decisões e provas do caso']){
   const p=planChatWork(prompt);
   expect(p.mode).toBe('deep');
   expect(p.maxTokens).toBeGreaterThan(1500);
  }
 });
 it('não reduz leitura de documentos anexos',()=>{
  expect(planChatWork('Analise este PDF',{hasPdf:true}).mode).toBe('deep');
 });
 it('resumos comuns não pedem uma segunda resposta duplicada',()=>{
  expect(planChatWork('Qual é a situação do processo 8007617-77.2023.8.05.0154').allowRepair).toBe(false);
 });
});
