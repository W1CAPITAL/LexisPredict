import {describe,it,expect} from 'vitest';
import {ROUTE_PLAYBOOKS,ROUTE_INVENTORY,playbooksForRoute,recommendAgentTeamForRoute} from './route-playbooks';

describe('especialidades Lexis por rota',()=>{
 it('covers all mission-critical tabs with accountable quality gates',()=>{
  for(const route of ['/chat','/superagente','/processos','/tarefas','/vencidos','/whatsapp','/report','/report/completo','/crm/agentes','/integracoes','/settings','/documents','/dossies']){
   const plan=recommendAgentTeamForRoute(route);
   expect(plan.specialists.length).toBeGreaterThan(0);
   expect(plan.checks.length).toBeGreaterThan(0);
   expect(plan.readOnlyByDefault).toBe(true);
   expect(plan.modelRequired).toBe(false);
  }
  expect(ROUTE_INVENTORY.length).toBeGreaterThan(65);
 });
 it('does not infer unknown admin permissions or auto-run a model',()=>{
  expect(playbooksForRoute('/route-not-existing')).toEqual([]);
  expect(recommendAgentTeamForRoute('/chat').modelRequired).toBe(false);
 });
 it('includes privacy and human quality review of sensitive modules',()=>{
  const whatsapp=playbooksForRoute('/whatsapp')[0];
  expect(whatsapp.proposed).toMatch(/opt-out/i);
  expect(whatsapp.requiresReview).toBe(true);
  const pdf=playbooksForRoute('/report/completo')[0];
  expect(pdf.specialists.join(' ')).toMatch(/PDF/);
  expect(ROUTE_PLAYBOOKS.some(x=>/API/i.test(x.apiOpportunity))).toBe(true);
 });
});
