import {describe,it,expect} from 'vitest';
import {matchesAppRouteSearch,resolveQuickCnjSearch,routeKeywords} from './app-route-search';

describe('Busca única do LexisPredict em todos os módulos',()=>{
 it('encontra funções pelas palavras do trabalho e mantém a rota já existente',()=>{
  expect(matchesAppRouteSearch('assinatura assinafy','Peças jurídicas','/documents/generator')).toBe(true);
  expect(matchesAppRouteSearch('assinafy assinatura','Documentos','/documents')).toBe(true);
  expect(matchesAppRouteSearch('pje office','Consulta OAB','/consulta-oab')).toBe(true);
  expect(matchesAppRouteSearch('revisão de provas','Réplica e provas','/fases-provas')).toBe(true);
  expect(matchesAppRouteSearch('agenda google','Integrações','/integracoes')).toBe(true);
  expect(matchesAppRouteSearch('cobrança asaas','Integrações','/integracoes')).toBe(true);
  expect(matchesAppRouteSearch('dossie','Dossiês','/dossies')).toBe(true);
 });
 it('funciona com letras acentuadas e só direciona para rotas que já existem',()=>{
  expect(routeKeywords('/documents/generator')).toContain('assinafy');
  expect(matchesAppRouteSearch('procuracao','Peças','/documents/generator')).toBe(true);
  expect(matchesAppRouteSearch('assinatura','Processos parados','/processos-parados')).toBe(false);
 });
 it('só oferece busca direta por CNJ quando número tem DV válido',()=>{
  expect(resolveQuickCnjSearch('0829229-82.2024.8.19.0209')).toBe('/processos?search=08292298220248190209');
  expect(resolveQuickCnjSearch('0829229-83.2024.8.19.0209')).toBeNull();
  expect(resolveQuickCnjSearch('12345678901234567890')).toBeNull();
  expect(resolveQuickCnjSearch('número qualquer aqui')).toBeNull();
 });
});