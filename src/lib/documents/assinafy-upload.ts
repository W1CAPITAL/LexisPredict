/**
 * Validação determinística para preparo de PDF no workspace Assinafy.
 * Regras reproduzidas da API e do SDK oficial @assinafy/sdk (MIT), src/resources/upload.ts.
 * Nenhuma rotina envia documentos sem ação explícita na camada de aplicação.
 */
export const ASSINAFY_MAX_PDF_BYTES=25*1024*1024;

export function normalizeAssinafyName(raw:string):string{
 const base=String(raw||'documento.pdf').split(/[\\/]/).pop()||'documento.pdf';
 const safe=base.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9 ._-]/g,'_').trim().slice(0,120);
 return safe||'documento.pdf';
}

export function validateAssinafyPdf(bytes:Uint8Array,name:string):{ok:true;name:string}|{ok:false;error:string}{
 const normalized=normalizeAssinafyName(name);
 if(!normalized.toLowerCase().endsWith('.pdf'))return {ok:false,error:'Somente arquivos PDF são aceitos.'};
 if(!bytes.length)return {ok:false,error:'O arquivo PDF está vazio.'};
 if(bytes.length>ASSINAFY_MAX_PDF_BYTES)return {ok:false,error:'O PDF excede o limite da Assinafy (25 MB).'};
 if(bytes.length<5||bytes[0]!==37||bytes[1]!==80||bytes[2]!==68||bytes[3]!==70||bytes[4]!==45)
  return {ok:false,error:'O arquivo não possui assinatura de conteúdo PDF válida.'};
 return {ok:true,name:normalized};
}
