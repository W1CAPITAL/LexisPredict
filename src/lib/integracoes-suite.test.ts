import {describe,it,expect} from 'vitest';
import {buildCalendarEventUrl,buildIcsFile,normalizeLawyerSearch,mapAsaasPayment} from './integracoes-suite';

describe('Suite de integrações LexisPredict',()=>{
 it('cria evento de retorno como dia inteiro sem alterar data na conversão do fuso',()=>{
   const url=new URL(buildCalendarEventUrl({cnj:'8007617-77.2023.8.05.0154',title:'Retorno processual',date:'2026-11-04'}));
   expect(url.hostname).toBe('calendar.google.com');
   expect(url.searchParams.get('dates')).toBe('20261104/20261105');
   expect(url.searchParams.get('ctz')).toBe('America/Sao_Paulo');
   expect(url.searchParams.get('text')).toContain('Retorno processual');
 });
 it('rejeita datas inexistentes e entradas que possam gerar agendamentos falsos',()=>{
   expect(()=>buildCalendarEventUrl({cnj:'test',title:'teste',date:'2026-02-30'})).toThrow();
   expect(()=>buildCalendarEventUrl({cnj:'test',title:'teste',date:'2026-11-04',time:'28:99'})).toThrow();
 });
 it('emite ICS válido e protege injeção de quebras de linha',()=>{
   const ics=buildIcsFile({cnj:'8007617-77.2023.8.05.0154',title:'Consulta\nATTENDEE:evil@example.org',date:'2026-11-04'});
   expect(ics).toContain('BEGIN:VCALENDAR\r\n');
   expect(ics).toContain('DTSTART;VALUE=DATE:20261104');
   expect(ics).toContain('DTEND;VALUE=DATE:20261105');
   expect(ics).not.toContain('\r\nATTENDEE:evil@example.org\r\n');
 });
 it('nunca sugere que texto arbitrário prova vínculo com OAB',()=>{
   expect(normalizeLawyerSearch(' Maria  da Silva ')).toBe('MARIA DA SILVA');
   expect(normalizeLawyerSearch('A')).toBeNull();
   expect(normalizeLawyerSearch('<script>')).toBeNull();
 });
 it('retorna apenas campos de cobrança permitidos na interface, sem dados bancários sensíveis',()=>{
   const mapped=mapAsaasPayment({id:'pay_abc',value:150,status:'PENDING',dueDate:'2026-11-10',billingType:'PIX',invoiceUrl:'https://www.asaas.com/i/test',creditCardToken:'secret',customer:'cus_x'});
   expect(mapped).toMatchObject({id:'pay_abc',value:150,status:'PENDING'});
   expect('creditCardToken' in mapped).toBe(false);
   expect('customer' in mapped).toBe(false);
 });
});