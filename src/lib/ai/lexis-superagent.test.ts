import {describe,it,expect} from 'vitest';
import {detectSuperAgentTask,requestedIncisiveMode,extractCaseSearch,extractCnjDigits,superAgentInstructions} from './lexis-superagent';

describe('Superagente LexisPredict: roteamento verificável',()=>{
 it('prioriza atendimento específico a cliente sem misturar relatório',()=>{
  expect(detectSuperAgentTask('Responda ao cliente Pedro sobre o processo')).toBe('atendimento');
 });
 it('identifica dossiês e investigações',()=>{
  expect(detectSuperAgentTask('Monte um dossiê com cronologia e provas')).toBe('dossie');
  expect(detectSuperAgentTask('Investigue erros e omissões do escritório')).toBe('investigacao');
  expect(detectSuperAgentTask('Relatório completo dos casos ativos')).toBe('relatorio');
 });
 it('modo incisivo não ativa em mensagem neutra nem por menção a erro',()=>{
  expect(requestedIncisiveMode('Analise os erros e responsabilidades')).toBe(false);
  expect(requestedIncisiveMode('Use o modo agressivo e cite as provas')).toBe(true);
  expect(requestedIncisiveMode('Seja agressivo na análise interna')).toBe(true);
 });
 it('aceita CNJ formatado e sem máscara',()=>{
  expect(extractCnjDigits('processo 1041688-64.2024.8.26.0007')).toBe('10416886420248260007');
  expect(extractCnjDigits('10416886420248260007')).toBe('10416886420248260007');
  expect(extractCaseSearch('Quero o processo do Pedro')).toBe('Pedro');
 });
 it('não busca pessoa quando a pergunta é geral',()=>{
  expect(extractCaseSearch('Explique como funciona cumprimento de sentença')).toBeNull();
  expect(extractCaseSearch('Processo de empresa genérica')).toBeNull();
 });
 it('não promete envio automático ou culpa sem confirmação',()=>{
  const d=superAgentInstructions('Quero dossiê do processo de Pedro');
  expect(d).toContain('CONFIRMADO');
  expect(d).toContain('nunca');
  expect(d).toContain('Revisão');
 });
});
