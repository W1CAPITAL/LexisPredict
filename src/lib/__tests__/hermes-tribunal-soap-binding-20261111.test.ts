import {describe,it,expect,vi,afterEach} from 'vitest';
import {readFileSync} from 'node:fs';
import {runOfficialTribunalConnector} from '@/lib/hermes-tribunal-adapters';
afterEach(()=>vi.unstubAllGlobals());
const cnj='00684979520268160014';
const ns='http://www.cnj.jus.br/servico-intercomunicacao-2.2.2/';
const wsdl='<wsdl:definitions xmlns:wsdl="http://schemas.xmlsoap.org/wsdl/" targetNamespace="'+ns+'"><wsdl:binding><wsdl:operation name="consultarProcesso"><soap:operation xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/" soapAction="'+ns+'consultarProcesso"/></wsdl:operation></wsdl:binding></wsdl:definitions>';
describe('TJPR SCMPP MNI SOAP binding real',()=>{
 it('usa tipos-servico para argumentos e SOAPAction publicado no contrato, não action curta',async()=>{
  const f=vi.fn()
   .mockResolvedValueOnce(new Response(wsdl,{status:200}))
   .mockResolvedValueOnce(new Response('<soap:Fault/>',{status:500}));
  vi.stubGlobal('fetch',f);
  const x=await runOfficialTribunalConnector(cnj);
  expect(x.status).toBe('restricted');
  expect(f).toHaveBeenCalledTimes(2);
  const headers=f.mock.calls[1][1].headers as Record<string,string>;
  expect(headers.SOAPAction).toBe('"'+ns+'consultarProcesso"');
  const body=String(f.mock.calls[1][1].body);
  expect(body).toContain('xmlns:tip="http://www.cnj.jus.br/tipos-servico-intercomunicacao-2.2.2"');
  expect(body).toContain('<tip:numeroProcesso>'+cnj+'</tip:numeroProcesso>');
  expect(body).toContain('<tip:incluirDocumentos>false</tip:incluirDocumentos>');
  expect(body).not.toContain('<mni:idConsultante>');
  expect(body).not.toContain('<mni:numeroProcesso>');
 });
 it('SOAP HTTP 500 é falha do protocolo, não movimento verificado',async()=>{
  const f=vi.fn()
   .mockResolvedValueOnce(new Response(wsdl,{status:200}))
   .mockResolvedValueOnce(new Response('<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Body><soapenv:Fault><faultcode>soapenv:Client</faultcode><faultstring>Invalid request</faultstring></soapenv:Fault></soapenv:Body></soapenv:Envelope>',{status:500}));
  vi.stubGlobal('fetch',f);
  const r=await runOfficialTribunalConnector(cnj);
  expect(r.status).toBe('restricted');expect(r.movements).toEqual([]);
 });
 it('um erro HTTP 500 pausa todos os processos da mesma fonte sem bloquear tribunal diferente',()=>{
  const sql=readFileSync('supabase/migrations/20261111213000_hermes_tribunal_global_cooldown.sql','utf8');
  expect(sql).toContain('AND NOT EXISTS');
  expect(sql).toContain('busy.adapter');
  expect(sql).toContain("busy.status='unavailable'");
  expect(sql).toContain("interval '4 hours'");
  expect(sql).toContain("busy.status='restricted'");
  expect(sql).toContain("interval '24 hours'");
  expect(sql).toContain('SKIP LOCKED');
 });

 it('usa SOAPAction exclusivo da operacao consultarProcesso, ignorando outras operacoes do WSDL',async()=>{
  const multi='<wsdl:definitions xmlns:wsdl="http://schemas.xmlsoap.org/wsdl/" targetNamespace="'+ns+'"><wsdl:binding><wsdl:operation name="consultarAvisos"><soap:operation xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/" soapAction="urn:outro"/></wsdl:operation><wsdl:operation name="consultarProcesso"><soap:operation xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/" soapAction="urn:tjpr:consultarProcesso"/></wsdl:operation></wsdl:binding></wsdl:definitions>';
  const f=vi.fn().mockResolvedValueOnce(new Response(multi,{status:200})).mockResolvedValueOnce(new Response('<soap:Fault/>',{status:500}));
  vi.stubGlobal('fetch',f);
  await runOfficialTribunalConnector(cnj);
  expect(f).toHaveBeenCalledTimes(2);
  expect(f.mock.calls[1][1].headers.SOAPAction).toBe('"urn:tjpr:consultarProcesso"');
 });
 it('preserva SOAPAction vazio quando assim anunciado no binding oficial',async()=>{
  const blank='<wsdl:definitions xmlns:wsdl="http://schemas.xmlsoap.org/wsdl/" targetNamespace="'+ns+'"><wsdl:binding><wsdl:operation name="consultarProcesso"><soap:operation xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/" soapAction=""/></wsdl:operation></wsdl:binding></wsdl:definitions>';
  const f=vi.fn().mockResolvedValueOnce(new Response(blank,{status:200})).mockResolvedValueOnce(new Response('<soap:Fault/>',{status:500}));
  vi.stubGlobal('fetch',f);
  await runOfficialTribunalConnector(cnj);
  expect(f).toHaveBeenCalledTimes(2);
  expect(f.mock.calls[1][1].headers.SOAPAction).toBe('""');
 });

});
