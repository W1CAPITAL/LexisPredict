import {canonicalCnj} from './autos-oab-logic';
import {getTribunalByCnj,TODOS_TRIBUNAIS,type TribunalLink} from './tribunais-links';

export type OabOfficialPortal={
 tribunal:string;sistema:string;url:string;isFallback:boolean;
 requiresUserAuth:true;portalIsPublicConsultation:true;
 authenticatedUrl:string|null;secondDegreeAuthenticatedUrl:string|null;
};
function acceptedCourt(row:TribunalLink|undefined|null,isFallback:boolean):OabOfficialPortal|null{
 if(!row)return null;
 try{
  const url=new URL(row.url);
  // No dynamic URL comes from a user profile.
  if(url.protocol!=='https:'||!(url.hostname==='jus.br'||url.hostname.endsWith('.jus.br')))return null;
  // Only court URLs verified against an official source are offered as login links.
  // Never construct private court endpoints from arbitrary CNJ or hostname guesses.
  const authentication=row.sigla==='TJBA'
    ?{authenticatedUrl:'https://pje.tjba.jus.br/pje/login.seam',
      secondDegreeAuthenticatedUrl:'https://pje2g.tjba.jus.br/pje/login.seam'}
    :{authenticatedUrl:null,secondDegreeAuthenticatedUrl:null};
  return {tribunal:row.sigla,sistema:row.sistema,url:url.href,isFallback,
   requiresUserAuth:true,portalIsPublicConsultation:true,...authentication};
 }catch{return null;}
}
/** The CNJ always wins over any saved favorite. A public URL does NOT log into the court. */
export function resolveOabOfficialPortal(cnjInput:string,preferredTribunal=''):OabOfficialPortal|null{
 const text=String(cnjInput||'').trim();
 if(text){
  const cnj=canonicalCnj(text);
  return cnj?acceptedCourt(getTribunalByCnj(cnj),false):null;
 }
 const favorite=TODOS_TRIBUNAIS.find(t=>t.codigo===preferredTribunal);
 return acceptedCourt(favorite,true);
}
