import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {buildHermesJudicialFindings} from '@/lib/hermes-judicial-findings';
import type {HermesCourtEvent} from '@/lib/hermes-return-policy';
const read=(file:string)=>readFileSync(file,'utf8');
const ev=(source:HermesCourtEvent['source'],text:string,date='2026-11-10'):HermesCourtEvent=>({source,text,at:date,url:source==='DJEN'?'https://comunica.pje.jus.br/':null});

describe('Hermes: evidências jurídicas da carteira completa',()=>{
 it('classifica sentença parcial, procedente e improcedente apenas por dispositivo explícito',()=>{
  for(const [text,merit] of [
   ['Julgado(s) procedente(s) em parte o(s) pedido(s)', 'parcialmente_procedente'],
   ['JULGO PROCEDENTE o pedido do autor', 'procedente'],
   ['JULGO IMPROCEDENTES os pedidos formulados', 'improcedente']
  ]){
   const result=buildHermesJudicialFindings([ev('DataJud',text)]);
   expect(result.verdict?.value).toBe(merit);
   expect(result.verdict?.source).toBe('DataJud');
  }
 });
 it('não confunde tutela negada, recursos ou alegações com julgamento final',()=>{
  for(const text of [
   'Indefiro a tutela de urgência, mantendo os pedidos para julgamento.',
   'Recurso contra sentença que julgou improcedente outra ação.',
   'A parte requer seja julgado procedente o pedido em momento oportuno.'
  ])expect(buildHermesJudicialFindings([ev('DJEN',text)]).verdict).toBeNull();
 });
 it('reconhece cumprimento, honorários e custas sem criar valores nem fixar cobrança indevida',()=>{
  const found=buildHermesJudicialFindings([
   ev('DJEN','Determino a instauração do cumprimento de sentença. Fixo honorários sucumbenciais de 10% sobre o valor da condenação. Indefiro o pedido de justiça gratuita. Custas processuais conforme tabela.'),
  ]);
  expect(found.enforcement?.value).toBe('cumprimento_iniciado');
  expect(found.attorneyFees?.percentage).toBe(10);
  expect(found.legalAid?.value).toBe('indeferida');
  expect(found.courtCosts?.value).toBe('custas_mencionadas');
  expect(found.courtCosts?.amount).toBeNull();
 });
 it('não presume custas exigíveis quando existe gratuidade, nem resultado de recurso como sentença',()=>{
  const found=buildHermesJudicialFindings([ev('DJEN','Defiro a justiça gratuita. Fixadas as custas em R$ 200,00 conforme sentença.')]);
  expect(found.legalAid?.value).toBe('deferida');
  expect(found.courtCosts?.paymentStatus).toBe('nao_determinado');
 });
 it('indexa audiência somente com data explícita e link confiável presente na publicação oficial',()=>{
  const found=buildHermesJudicialFindings([ev('DJEN','Designo audiência de instrução para o dia 18/12/2026 às 10h30, por videoconferência: https://meet.google.com/abc-defg-hij')]);
  expect(found.hearings[0]?.date).toBe('2026-12-18');
  expect(found.hearings[0]?.time).toBe('10:30');
  expect(found.hearings[0]?.meetingUrl).toBe('https://meet.google.com/abc-defg-hij');
 });
 it('não transforma data de publicação em data de audiência',()=>{
  const result=buildHermesJudicialFindings([ev('DJEN','Audiência poderá ser designada oportunamente.')]);
  expect(result.hearings).toHaveLength(0);
 });
 it('traz evidência e grau de confirmação para toda conclusão; DJEN não representa o histórico integral',()=>{
  const result=buildHermesJudicialFindings([ev('DJEN','Julgo procedente o pedido')]);
  expect(result.verdict?.basis).toBe('indicio_textual');
  expect(result.verdict?.excerpt).toContain('Julgo procedente');
  expect(result.allCourtMovementsConfirmed).toBe(false);
 });
 it('tem cron próprio e acesso autenticado sem usar status de retorno administrativo',()=>{
  const route=read('src/app/api/cron/hermes-returns/route.ts');
  expect(route).toContain("mode === 'portfolio'");
  expect(route).toContain('runHermesPortfolioScanBatch');
  expect(route.indexOf("if (!authorized(request))")).toBeLessThan(route.indexOf("mode === 'portfolio'"));
  const service=read('src/lib/hermes-return-service.ts');
  expect(service).toContain("rpc('hermes_claim_portfolio_scan'");
  expect(service).toContain("from('hermes_portfolio_scans')");
  expect(service).toContain('atualizarAudienciasDeConsulta');
  expect(service).not.toContain('sendWhatsApp');
 });
 it('protege o banco por empresa, cobre todos os processos ativos com CNJ, sem exigir estarem parados',()=>{
  const sql=read('supabase/migrations/20261111080000_hermes_portfolio_scans.sql');
  expect(sql).toContain('enable row level security');
  expect(sql).toContain('service_role');
  expect(sql).toContain('hermes_claim_portfolio_scan');
  expect(sql).toContain('p.empresa_id is not null');
  expect(sql).not.toContain('ultima_movimentacao <');
  expect(sql).not.toContain('proximo_retorno<=p_today');
 });
 it('o veredito mostra fonte jurídica confirmada e o relatório Hermes lista as consultas',()=>{
  expect(read('src/app/veredito/page.tsx')).toContain('getHermesPortfolioByCnjAction');
  expect(read('src/app/veredito/page.tsx')).toContain('Conclusões encontradas em fontes oficiais');
  expect(read('src/app/api/cron/hermes-returns/route.ts')).toContain('getHermesPortfolioSummaries');
  expect(read('src/components/hermes/hermes-portfolio-monitoring.tsx')).toContain('Histórico judicial');
  expect(read('src/components/pdf/hermes-legal-pdf.tsx')).toContain('portfolioScans');
 });
});
