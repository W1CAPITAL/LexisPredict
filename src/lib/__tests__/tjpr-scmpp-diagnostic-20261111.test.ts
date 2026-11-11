import {afterEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {probeTjprScmppWsdl} from '@/lib/tjpr-scmpp-diagnostic';

const first='https://projudi.tjpr.jus.br/projudi_consulta/webservices/projudiIntercomunicacaoWebService222?wsdl';
afterEach(()=>vi.unstubAllGlobals());

describe('SCMPP TJPR: apenas diagnosticar a disponibilidade real do contrato oficial',()=>{
 it('detecta contrato WSDL SOAP com método consultarProcesso, sem afirmar histórico consultado',async()=>{
  const fetcher=vi.fn().mockResolvedValue(new Response(
   '<?xml version="1.0"?><wsdl:definitions xmlns:wsdl="http://schemas.xmlsoap.org/wsdl/"><wsdl:portType name="MNI"><wsdl:operation name="consultarProcesso"/></wsdl:portType></wsdl:definitions>',
   {status:200,headers:{'content-type':'text/xml'}}
  ));
  vi.stubGlobal('fetch',fetcher);
  const r=await probeTjprScmppWsdl('1g');
  expect(r).toMatchObject({status:'wsdl_detected',instance:'1g',httpStatus:200,movementsConfirmed:false});
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][0]).toBe(first);
  expect(fetcher.mock.calls[0][1].redirect).toBe('error');
 });
 it('troca para a URL fixa de 2º grau, sem aceitar URL livre do usuário',async()=>{
  const fetcher=vi.fn().mockResolvedValue(new Response(
   '<wsdl:definitions xmlns:wsdl="http://schemas.xmlsoap.org/wsdl/"><wsdl:operation name="consultarProcesso"/></wsdl:definitions>',
   {status:200}
  ));vi.stubGlobal('fetch',fetcher);
  const result=await probeTjprScmppWsdl('2g');
  expect(result.instance).toBe('2g');
  expect(fetcher.mock.calls[0][0]).toContain('projudiIntercomunicacaoWebService2G222?wsdl');
 });
 it('página de login ou CAPTCHA não é um WSDL confirmado',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('<html>login captcha</html>',{status:200})));
  const r=await probeTjprScmppWsdl('1g');
  expect(r.status).toBe('unexpected_response');
  expect(r.movementsConfirmed).toBe(false);
 });
 it('HTTP 403 ou 429 não gera novos requests, nem confirma movimentações',async()=>{
  const fetcher=vi.fn().mockResolvedValue(new Response('Forbidden',{status:403}));
  vi.stubGlobal('fetch',fetcher);
  const r=await probeTjprScmppWsdl('1g');
  expect(r.status).toBe('restricted');expect(r.movementsConfirmed).toBe(false);
  expect(fetcher).toHaveBeenCalledTimes(1);
  fetcher.mockResolvedValueOnce(new Response('Too many requests',{status:429}));
  expect((await probeTjprScmppWsdl('1g')).status).toBe('rate_limited');
  expect(fetcher).toHaveBeenCalledTimes(2);
 });
 it('falha de rede mostra indisponibilidade, sem expor stack trace/credenciais',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(Error('secret-internal-network')));
  const r=await probeTjprScmppWsdl('1g');
  expect(r.status).toBe('unavailable');
  expect(JSON.stringify(r)).not.toContain('secret-internal-network');
  expect(r.movementsConfirmed).toBe(false);
 });
 it('reutiliza a rota autenticada Hermes sem criar função Vercel',()=>{
  const route=readFileSync('src/app/api/cron/hermes-returns/route.ts','utf8');
  const ui=readFileSync('src/components/hermes/hermes-return-review-button.tsx','utf8');
  expect(route).toContain("action')==='scmpp-health'");
  expect(route).toContain('getUserContext()');
  expect(route).toContain('probeTjprScmppWsdl');
  expect(ui).toContain('Testar acesso SCMPP');
  expect(ui).toContain("action=scmpp-health");
  expect(ui).toContain('Nenhuma movimentação é confirmada por este teste');
 });
});
