import {afterEach,describe,expect,it,vi} from 'vitest';
import {createHash} from 'node:crypto';
import {buildTJPRMniDynamicPassword,fetchTJPRProjudiProcess} from '@/lib/tjpr-projudi-mni';

const cnj='0068497-95.2026.8.16.0014';
const digits='00684979520268160014';
const xml=`<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
 xmlns:svc="http://www.cnj.jus.br/servico-intercomunicacao-2.2.2/"
 xmlns:types="http://www.cnj.jus.br/tipos-servico-intercomunicacao-2.2.2"
 xmlns:mni="http://www.cnj.jus.br/intercomunicacao-2.2.2">
 <soap:Body>
  <svc:consultarProcessoResposta>
   <types:sucesso>true</types:sucesso>
   <types:mensagem>Processo consultado com sucesso</types:mensagem>
   <types:processo>
     <mni:movimento dataHora="2026-11-11T10:14:00-03:00" nivelSigilo="0">
      <mni:movimentoLocal codigoMovimento="1" codigoPaiNacional="1" descricao="Concedida justiça gratuita"/>
      <mni:complemento>Intimação para apresentação de contestação</mni:complemento>
     </mni:movimento>
     <mni:movimento dataHora="2026-11-10T09:00:00-03:00" nivelSigilo="2">
      <mni:movimentoLocal codigoMovimento="2" codigoPaiNacional="2" descricao="Movimento sigiloso"/>
     </mni:movimento>
   </types:processo>
  </svc:consultarProcessoResposta>
 </soap:Body>
</soap:Envelope>`;

afterEach(()=>{
 vi.unstubAllGlobals();
 vi.useRealTimers();
});

describe('TJPR PROJUDI MNI 2.2.2',()=>{
 it('gera a senha dinâmica MD5 do código mais a data de Brasília',()=>{
  const expected=createHash('md5').update('CODIGO20261111').digest('hex');
  expect(buildTJPRMniDynamicPassword('CODIGO',new Date('2026-11-11T15:00:00.000Z'))).toBe(expected);
 });

 it('não tenta automatizar a tela pública protegida por captcha quando não há credenciais MNI',async()=>{
  const result=await fetchTJPRProjudiProcess(cnj,{credentials:null,fetchImpl:vi.fn() as any});
  expect(result).toMatchObject({
   applicable:true,configured:false,ok:false,found:false,errorCode:'not_configured',
  });
  expect(result.events).toEqual([]);
 });

 it('consulta o endpoint oficial de primeira instância e extrai somente movimentos públicos',async()=>{
  const fetchMock=vi.fn().mockResolvedValue(new Response(xml,{status:200,headers:{'content-type':'text/xml'}}));
  const result=await fetchTJPRProjudiProcess(cnj,{
   credentials:{id:'integracao-tjpr',code:'CODIGO'},
   now:new Date('2026-11-11T15:00:00.000Z'),
   fetchImpl:fetchMock as any,
  });
  expect(result).toMatchObject({applicable:true,configured:true,ok:true,found:true,source:'TJPR PROJUDI'});
  expect(result.events).toHaveLength(1);
  expect(result.events[0]).toMatchObject({
   at:'2026-11-11T10:14:00-03:00',
   text:'Concedida justiça gratuita · Intimação para apresentação de contestação',
  });
  const [url,init]=fetchMock.mock.calls[0];
  expect(String(url)).toContain('/projudiIntercomunicacaoWebService222');
  expect(init.headers.SOAPAction).toContain('/consultarProcesso');
  expect(init.body).toContain('<types:numeroProcesso>'+digits+'</types:numeroProcesso>');
  expect(init.body).toContain('<types:movimentos>true</types:movimentos>');
  expect(init.body).toContain('<types:incluirDocumentos>false</types:incluirDocumentos>');
  expect(init.body).toContain(createHash('md5').update('CODIGO20261111').digest('hex'));
  expect(init.body).not.toContain('Movimento sigiloso');
 });

 it('usa o endpoint oficial de segunda instância para processos terminados em 9000',async()=>{
  const fetchMock=vi.fn().mockResolvedValue(new Response(xml,{status:200}));
  const result=await fetchTJPRProjudiProcess('0000001-52.2008.8.16.9000',{
   credentials:{id:'integracao-tjpr',code:'CODIGO'},
   now:new Date('2026-11-11T15:00:00.000Z'),
   fetchImpl:fetchMock as any,
  });
  expect(result.applicable).toBe(true);
  expect(String(fetchMock.mock.calls[0][0])).toContain('projudiIntercomunicacaoWebService2G222');
 });

 it('registra 429 como limitação da fonte sem declarar processo ausente',async()=>{
  const fetchMock=vi.fn().mockResolvedValue(new Response('temporariamente indisponível',{status:429}));
  const result=await fetchTJPRProjudiProcess(cnj,{
   credentials:{id:'integracao-tjpr',code:'CODIGO'},
   fetchImpl:fetchMock as any,
  });
  expect(result).toMatchObject({ok:false,found:false,errorCode:'rate_limited'});
 });

 it('não confirma processo quando o MNI devolve sucesso sem o objeto processual',async()=>{
  const empty='<Envelope><consultarProcessoResposta><sucesso>true</sucesso><mensagem>Sem processo</mensagem></consultarProcessoResposta></Envelope>';
  const result=await fetchTJPRProjudiProcess(cnj,{
   credentials:{id:'integracao-tjpr',code:'CODIGO'},
   fetchImpl:vi.fn().mockResolvedValue(new Response(empty,{status:200})) as any,
  });
  expect(result).toMatchObject({ok:false,found:false,errorCode:'not_found'});
 });
});
