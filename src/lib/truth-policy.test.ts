import {describe,it,expect} from 'vitest';
import {assessEvidenceTrace,formatEvidenceGuidance} from './truth-policy';

describe('Rastreabilidade jurídica compartilhada no app',()=>{
 it('não transforma referência digitada em fato verificado',()=>{
  const ev=assessEvidenceTrace('Relato do cliente 12/10');
  expect(ev.status).toBe('informada-nao-verificada');
  expect(ev.requiresReview).toBe(true);
 });
 it('marca ausência e não inventa prova, prazo ou fonte',()=>{
  const ev=assessEvidenceTrace('');
  expect(ev.status).toBe('ausente');
  expect(ev.references).toEqual([]);
 });
 it('preserva referências por linha e fornece orientação compartilhada',()=>{
  const ev=assessEvidenceTrace('Evento 14, p. 3\nContrato.pdf, p. 9');
  expect(ev.references).toHaveLength(2);
  expect(formatEvidenceGuidance()).toContain('CONFIRMADO');
  expect(formatEvidenceGuidance()).toContain('não confiáveis');
 });
});