/** Portais oficiais conferidos para consulta humana de movimentações.
 * Não faz scraping, contorna captcha, nem presume resposta de uma API.
 * Uma publicação DJEN não substitui a movimentação do processo no tribunal.
 */
export type OfficialCourtPortal={label:string;url:string;scope:string};

const PORTALS:Record<string,OfficialCourtPortal>={
 '8.26':{
  label:'TJSP · Consulta Unificada SAJ/eproc',
  url:'https://eproc1g.tjsp.jus.br/eproc',
  scope:'Consulta pública; selecione a instância e informe o CNJ no tribunal.',
 },
 '8.19':{
  label:'TJRJ · Consulta Processual',
  url:'https://www.tjrj.jus.br/consultas/processos-jud/formas-dispo-consultas',
  scope:'Consulta pública por número; selecione o sistema e a instância.',
 },
 '8.13':{
  label:'TJMG · Consulta Pública PJe',
  url:'https://pje-consulta-publica.tjmg.jus.br/pje/login.seam',
  scope:'Consulta de PJe 1º grau; outros sistemas e graus exigem a opção apropriada no tribunal.',
 },
 '5.02':{
  label:'TRT2 · Consulta Processual Pública',
  url:'https://ww2.trt2.jus.br/servicos/acesso-online/processo-judicial-eletronico-pje/page',
  scope:'Portal oficial do TRT2 para selecionar consulta PJe pública.',
 },
};
export const OFFICIAL_DJEN_PUBLIC_PORTAL='https://comunica.pje.jus.br/';
export function resolveOfficialCourtPortal(cnj:unknown):OfficialCourtPortal|null{
 const digits=String(cnj||'').replace(/\D/g,'');
 if(digits.length!==20)return null;
 return PORTALS[digits[13]+'.'+digits.slice(14,16)]||null;
}
