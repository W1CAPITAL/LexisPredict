import {describe,expect,it} from 'vitest';
import {parseHermesMeetingTranscript,sanitizeHermesMeetingOutput} from '@/lib/hermes-company-intelligence';
describe('Hermes recorded meeting exchanges',()=>{
 it('preserves speaker turns from a real model response',()=>{
  const raw='Gerência: Priorizar retorno vencido.\nSupervisão: DataJud não respondeu; conferir a fonte.\nProcessos: DJEN retornou publicação.\nComunicação: Preparar rascunho, sem enviar.';
  const clean=sanitizeHermesMeetingOutput(raw);
  expect(clean).toContain('\nSupervisão:');
  const turns=parseHermesMeetingTranscript(clean);
  expect(turns).toHaveLength(4);
  expect(turns[1]).toMatchObject({speaker:'Supervisão',text:expect.stringContaining('DataJud')});
 });
 it('never fabricates conversations from an unstructured single paragraph',()=>{
  expect(parseHermesMeetingTranscript('A IA produziu apenas um resumo geral.')).toEqual([
    {speaker:'Síntese da IA',text:'A IA produziu apenas um resumo geral.'}
  ]);
 });
});
