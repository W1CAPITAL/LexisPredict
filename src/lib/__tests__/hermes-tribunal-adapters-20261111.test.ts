import {describe,it,expect,vi,afterEach} from 'vitest';
import {runOfficialTribunalConnector,parseMniPublicMovements,resolveOfficialTribunalAdapter} from '@/lib/hermes-tribunal-adapters';
import {readFileSync} from 'node:fs';
afterEach(()=>vi.unstubAllGlobals());
const CNJ='00684979520268160014';
const TJPE='00123456720268170001';
const WSDL='<?xml version="1.0"?><wsdl:definitions xmlns:wsdl="http://schemas.xmlsoap.org/wsdl/" targetNamespace="http://www.cnj.jus.br/servico-intercomunicacao-2.2.2/"><wsdl:operation name="consultarProcesso"/></wsdl:definitions>';
const SOAP='<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><mni:consultarProcessoResposta xmlns:mni="http://www.cnj.jus.br/servico-intercomunicacao-2.2.2/" sucesso="true"><mni:processo><mni:dadosBasicos numero="'+CNJ+'" nivelSigilo="0"/><mni:movimento dataHora="20261110143000"><mni:movimentoNacional codigoNacional="123"/></mni:movimento></mni:processo></mni:consultarProcessoResposta></soap:Body></soap:Envelope>';
describe('Hermes · conectores oficiais MNI/SCMPP com evidência verificada',()=>{
 it('oferece MNI somente para tribunais que publicam serviço oficial: TJPR e TJPE',()=>{
  expect(resolveOfficialTribunalAdapter(CNJ)?.code).toBe('tjpr-scmpp');
  expect(resolveOfficialTribunalAdapter(TJPE)?.code).toBe('tjpe-mni');
  expect(resolveOfficialTribunalAdapter('10193368020258260071')).toBeNull();
  expect(resolveOfficialTribunalAdapter('123')).toBeNull();
 });
 it('faz GET WSDL e SOAP apenas no endpoint oficial, com CNJ exato e documentos=false',async()=>{
  const fetcher=vi.fn()
   .mockResolvedValueOnce(new Response(WSDL,{status:200,headers:{'content-type':'text/xml'}}))
   .mockResolvedValueOnce(new Response(SOAP,{status:200,headers:{'content-type':'text/xml'}}));
  vi.stubGlobal('fetch',fetcher);
  const res=await runOfficialTribunalConnector(CNJ);
  expect(res.status).toBe('verified');expect(res.movements).toHaveLength(1);
  expect(res.movements[0]).toMatchObject({date:'2026-11-10',code:'123'});
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls[0][0]).toContain('projudi.tjpr.jus.br');
  expect(fetcher.mock.calls[1][0]).toContain('projudi.tjpr.jus.br');
  const soap=fetcher.mock.calls[1][1].body as string;
  expect(soap).toContain('<tip:numeroProcesso>'+CNJ+'</tip:numeroProcesso>');
  expect(soap).toContain('<tip:incluirDocumentos>false</tip:incluirDocumentos>');
  expect(fetcher.mock.calls[0][1].redirect).toBe('error');
  expect(fetcher.mock.calls[1][1].redirect).toBe('error');
 });
 it('não confunde processo divergente, privado ou SOAP fault com consulta concluída',()=>{
  expect(parseMniPublicMovements(SOAP.replace(CNJ,'99999999920268160014'),CNJ).status).toBe('cnj_mismatch');
  expect(parseMniPublicMovements(SOAP.replace('nivelSigilo="0"','nivelSigilo="1"'),CNJ).status).toBe('restricted');
  expect(parseMniPublicMovements('<Fault><faultstring>Credenciais inválidas</faultstring></Fault>',CNJ).status).toBe('restricted');
  expect(parseMniPublicMovements('<html>captcha login</html>',CNJ).status).toBe('unexpected_response');
 });
 it('HTTP 429/403 impede segunda chamada e ativa falha rastreável',async()=>{
  const f=vi.fn().mockResolvedValue(new Response('rate limited',{status:429}));
  vi.stubGlobal('fetch',f);
  expect((await runOfficialTribunalConnector(CNJ)).status).toBe('rate_limited');
  expect(f).toHaveBeenCalledTimes(1);
  f.mockResolvedValueOnce(new Response('Forbidden',{status:403}));
  expect((await runOfficialTribunalConnector(CNJ)).status).toBe('restricted');
 });
 it('CNJ não configurado não gera qualquer acesso externo',async()=>{
  const f=vi.fn();vi.stubGlobal('fetch',f);
  const r=await runOfficialTribunalConnector('10193368020258260071');
  expect(r.status).toBe('unsupported');expect(f).not.toHaveBeenCalled();
 });
 it('não vaza detalhes ou credenciais de respostas maliciosas',()=>{
  const r=parseMniPublicMovements(SOAP.replace('sucesso="true"','sucesso="false"'),CNJ);
  expect(r.status).toBe('unavailable');
  expect(JSON.stringify(r)).not.toContain('soap:Envelope');
 });
 it('o scanner automático compartilha a função Vercel existente com cron, e possui armazenamento isolado RLS',()=>{
  const route=readFileSync('src/app/api/cron/hermes-returns/route.ts','utf8');
  const code=readFileSync('src/lib/hermes-tribunal-scanner.ts','utf8');
  const sql=readFileSync('supabase/migrations/20261111_tribunal_connector_scanner.sql','utf8');
  expect(route).toContain("mode === 'court-connectors'");
  expect(code).toContain('hermes_claim_tribunal_connector');
  expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
  expect(sql).toContain("'*/15 * * * *'");
  expect(sql).toContain("hermesRoute=court-connectors");
 });
 it('o histórico de /processos inclui os movimentos verificados do tribunal, sem rotulá-los DataJud',()=>{
  const action=readFileSync('src/app/actions/processos-movements-action.ts','utf8');
  expect(action).toContain('hermes_tribunal_public_movements');
  expect(action).toContain("source:'Tribunal'");
  expect(action).toContain('movements_verified_at');
 });
});