/** Mapa de fontes judiciais oficiais para o Hermes.
 * Não automatizar portais e-SAJ/eproc/PJe/Projudi nem atravessar login/captcha/WAF.
 * TJPR é a exceção: disponibiliza o SCMPP/MNI 2.2.2 para consulta pública
 * automatizada sem cadastro, login ou senha, conforme Resolução TJPR 532-OE/2026.
 * Jus.br requer login; a API Datalake/GeCli requer aprovação.
 */
import {getTribunalByCnj} from '@/lib/tribunais-links';
import {TRIBUNAIS_TJ} from '@/lib/tribunais-links';

export type OfficialCourtPortal={label:string;url:string;scope:string};
export type HermesNationalSourcePlan={
 tribunal:string;
 alias:string;
 cnjCode:string;
 automated:string[];
 tribunalApiAutomated:boolean;
 tribunalApiAuthRequired:boolean;
 tribunalPortal:OfficialCourtPortal|null;
 otherPortals:OfficialCourtPortal[];
 jusbr:{url:'https://www.jus.br/';authRequired:true};
 datalake:{applicationUrl:'https://gestao-clientes.pdpj.jus.br/';requiresApproval:true};
};

const OVERRIDES:Record<string,OfficialCourtPortal>={
 '8.26':{label:'TJSP · Consulta Unificada eproc/e-SAJ',url:'https://eproc-consulta.tjsp.jus.br/consulta_1g/externo_controlador.php?acao=tjsp@consulta_unificada_publica/consultar',scope:'Consulta pública de 1º grau. A instância e o sistema podem variar.'},
 '8.19':{label:'TJRJ · Consulta Processual',url:'https://www.tjrj.jus.br/consultas/processos-jud/formas-dispo-consultas',scope:'Portal de consulta pública; escolha o sistema processual do processo.'},
 '8.13':{label:'TJMG · Consulta Pública PJe',url:'https://pje-consulta-publica.tjmg.jus.br/',scope:'Para PJe. Outros sistemas exigem consulta no portal do tribunal.'},
 '5.02':{label:'TRT2 · Processo Judicial Eletrônico',url:'https://ww2.trt2.jus.br/servicos/acesso-online/processo-judicial-eletronico-pje/page',scope:'Selecione a consulta pública e a instância.'},
 '5.03':{label:'TRT3 · Processo Judicial Eletrônico',url:'https://portal.trt3.jus.br/internet/servicos/pje',scope:'Portal oficial; consulta automatizada privada em massa não é autorizada.'},
 '4.03':{label:'TRF3 · Consulta Processual',url:'https://www.trf3.jus.br/',scope:'Escolha Justiça Federal de São Paulo, MS ou TRF3 e a instância.'},
 '4.05':{label:'TRF5 · Consulta Processual',url:'https://open.trf5.jus.br/index.php/consulta-processual-fisico-e-eletronico',scope:'Selecione o sistema processual adequado (PJe ou físico) e a instância.'},
 '2.00':{label:'STJ · Consulta Processual',url:'https://www.stj.jus.br/',scope:'Pesquisa pública oficial; processos restritos dependem de credenciais.'},
 '2.01':{label:'STJ · Consulta Processual',url:'https://www.stj.jus.br/',scope:'Pesquisa pública oficial; processos restritos dependem de credenciais.'},
 '3.00':{label:'TST · Portal Oficial',url:'https://www.tst.jus.br/',scope:'Selecione consulta processual pública.'},
 '3.01':{label:'TST · Portal Oficial',url:'https://www.tst.jus.br/',scope:'Selecione consulta processual pública.'},
 '6.00':{label:'TSE · Portal Oficial',url:'https://www.tse.jus.br/',scope:'Selecione consulta pública.'},
 '7.00':{label:'STM · Portal Oficial',url:'https://www.stm.jus.br/',scope:'Selecione consulta pública.'}
};

export const OFFICIAL_DJEN_PUBLIC_PORTAL='https://comunica.pje.jus.br/';
export const OFFICIAL_JUSBR_PORTAL='https://www.jus.br/';
export const OFFICIAL_GECLI_REQUEST='https://gestao-clientes.pdpj.jus.br/';

function courtAlias(code:string):string|null{
 const m=/^(\d)\.(\d{2})$/.exec(code);
 if(!m)return null;
 const justice=m[1],tribunal=Number(m[2]);
 if(justice==='8'){
  const tj=TRIBUNAIS_TJ.find(t=>t.codigo===code);
  return tj?tj.sigla.toLowerCase():null;
 }
 if(justice==='4'&&tribunal>=1&&tribunal<=6)return 'trf'+tribunal;
 if(justice==='5'&&tribunal>=1&&tribunal<=24)return 'trt'+tribunal;
 if(justice==='2'&&(tribunal===0||tribunal===1))return 'stj';
 if(justice==='3'&&(tribunal===0||tribunal===1))return 'tst';
 if(justice==='6'&&tribunal===0)return 'tse';
 if(justice==='7'&&tribunal===0)return 'stm';
 return null;
}
function isOfficialLink(url:string):boolean{
 try{
  const parsed=new URL(url);
  return parsed.protocol==='https:' &&
   (parsed.hostname==='jus.br'||parsed.hostname.endsWith('.jus.br'));
 }catch{return false;}
}

/** Usa o código ramo/tribunal da numeração CNJ, nunca o nome do estado presumido.
 * Todas as fontes são identificadas por jurisdição, com fallback autenticado Jus.br.
 */
export function getHermesNationalSourcePlan(cnj:unknown):HermesNationalSourcePlan|null{
 const digits=String(cnj||'').replace(/\D/g,'');
 if(digits.length!==20)return null;
 const code=digits[13]+'.'+digits.slice(14,16);
 const alias=courtAlias(code);
 if(!alias)return null;
 const catalog=getTribunalByCnj(digits);
 const explicit=OVERRIDES[code];
 const candidate=catalog&&isOfficialLink(catalog.url)?{
  label:catalog.sigla+' · '+catalog.sistema.toUpperCase(),
  url:catalog.url,
  scope:'Consulta pública do tribunal; verifique o grau e o sistema em que o processo tramita.',
 }:null;
 const tribunalPortal=explicit||candidate;
 const otherPortals=(catalog?.alternativos||[])
  .filter(portal=>isOfficialLink(portal.url)&&portal.url!==tribunalPortal?.url)
  .map(portal=>({
    label:alias.toUpperCase()+' · '+(portal.label||portal.sistema),
    url:portal.url,
    scope:'Pesquisa pública manual. Não disponível para automação por esta integração.',
  }));
 return {
  tribunal:alias.toUpperCase(),alias,cnjCode:code,
  automated:code==='8.16'?['DJEN','DataJud','TJPR PROJUDI MNI']:['DJEN','DataJud'],
  tribunalApiAutomated:code==='8.16',tribunalApiAuthRequired:false,
  tribunalPortal:tribunalPortal||null,otherPortals,
  jusbr:{url:'https://www.jus.br/',authRequired:true},
  datalake:{applicationUrl:'https://gestao-clientes.pdpj.jus.br/',requiresApproval:true},
 };
}
export type HermesOfficialFallbackMode='both-confirmed'|'djen-only'|'datajud-only'|'no-current-source';
export function classifyHermesOfficialFallback(datajudOk:boolean,djenOk:boolean):HermesOfficialFallbackMode{
 if(datajudOk&&djenOk)return 'both-confirmed';
 if(djenOk)return 'djen-only';
 if(datajudOk)return 'datajud-only';
 return 'no-current-source';
}
export function resolveOfficialCourtPortal(cnj:unknown):OfficialCourtPortal|null{
 const plan=getHermesNationalSourcePlan(cnj);
 if(!plan)return null;
 return plan.tribunalPortal||{
  label:plan.tribunal+' · Consulta via Jus.br',
  url:OFFICIAL_JUSBR_PORTAL,
  scope:'Login Gov.br ou certificado. A disponibilidade depende do seu perfil e do tribunal conectado.',
 };
}
