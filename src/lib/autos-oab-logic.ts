/** Seleção e validação de documentos de autos obtidos por acesso autorizado.
 * O texto do título não comprova quem apresentou a contestação.
 */
export type AutoOabDoc = {
 id:string;titulo:string;descricao:string;data:string;tipo:string;extensao:string;
 key:string;paginas:number|null;tipoDetectado:'contestacao'|'inicial'|'outro';
};

export function canonicalCnj(value:unknown):string|null {
 const digits=String(value??'').replace(/\D/g,'');
 if(digits.length!==20)return null;
 return `${digits.slice(0,7)}-${digits.slice(7,9)}.${digits.slice(9,13)}.${digits.slice(13,14)}.${digits.slice(14,16)}.${digits.slice(16,20)}`;
}
export function isSafeAutosKey(value:unknown):value is string {
 const text=String(value??'');
 return text.length>0&&text.length<=1024&&/^[a-zA-Z0-9_+\/=\-]+$/.test(text);
}
export function extractAutosDocuments(payload:unknown):AutoOabDoc[]{
 const raw=payload as {items?:unknown;data?:{items?:unknown}}|null;
 const rows=Array.isArray(raw?.items)?raw.items:Array.isArray(raw?.data?.items)?raw!.data!.items:[];
 const seen=new Set<string>();
 return rows.flatMap((doc:unknown)=>{
   if(!doc||typeof doc!=='object')return [];
   const v=doc as Record<string,unknown>;
   const key=String(v.key||'');
   if(!isSafeAutosKey(key)||seen.has(key))return [];
   seen.add(key);
   const titulo=String(v.titulo||v.nome||'Documento').trim().slice(0,240);
   const descricao=String(v.descricao||'').trim().slice(0,420);
   const combined=(titulo+' '+descricao).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
   const tipoDetectado:AutoOabDoc['tipoDetectado']=/contesta[cç][aã]o|peca\s+de\s+defesa|defesa\s+do\s+r[eé]u/.test(combined)
      ?'contestacao':/peti[cç][aã]o\s+inicial|exordial/.test(combined)?'inicial':'outro';
   const ext=String(v.extensao_arquivo||'bin').replace(/[^a-z0-9]/gi,'').toLowerCase().slice(0,8)||'bin';
   return [{
     id:String(v.id||key).slice(0,100),titulo,descricao,
     data:String(v.data||'').slice(0,40),tipo:String(v.tipo||'').slice(0,30),
     extensao:ext,key,paginas:Number.isFinite(v.quantidade_paginas)?Number(v.quantidade_paginas):null,
     tipoDetectado
   }];
 });
}

export function chronologicalThroughContestacao(documents:AutoOabDoc[]):{
 docs:AutoOabDoc[];foundContestacao:boolean;contestacaoIsBancoConfirmed:false;
}{
 const docs=[...documents].sort((a,b)=>a.data.localeCompare(b.data));
 const position=docs.findIndex(doc=>doc.tipoDetectado==='contestacao');
 return {docs:position<0?docs:docs.slice(0,position+1),foundContestacao:position>=0,contestacaoIsBancoConfirmed:false};
}
export function getDocumentLabel(doc:AutoOabDoc):string {
 return doc.titulo||'Peça processual';
}
