type KhojReference = {
  compiled?: string;
  raw?: string;
  file?: string;
  uri?: string;
  heading?: string;
};

function khojBase(){
  return String(process.env.KHOJ_URL||'').trim().replace(/\/$/,'');
}
function khojToken(){
  return String(process.env.KHOJ_TOKEN||process.env.KHOJ_API_TOKEN||'').trim();
}
export function khojConfigured(){
  return Boolean(khojBase()&&khojToken());
}
function headers(){
  return {
    Authorization:'Bearer '+khojToken(),
    'Content-Type':'application/json',
    Accept:'application/json',
  };
}
async function requestJson(url:string,init:RequestInit,timeoutMs:number){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),Math.max(1000,timeoutMs));
  try{
    const response=await fetch(url,{...init,signal:controller.signal,cache:'no-store'});
    const raw=await response.text();
    let data:any={};try{data=raw?JSON.parse(raw):{}}catch{data={raw}}
    if(!response.ok)throw new Error('Khoj HTTP '+response.status+': '+String(data?.detail||data?.message||raw).slice(0,240));
    return data;
  }finally{clearTimeout(timer)}
}
function shouldUse(query:string,hasDocument:boolean){
  if(!khojConfigured())return false;
  if(process.env.KHOJ_ALWAYS==='1')return true;
  if(hasDocument)return true;
  return /\b(documento|arquivo|pdf|contrato|peti[cç][aã]o|processo|jurisprud|lei|legal|jur[ií]dic|pesquis|fonte|mem[oó]ria|conhecimento|hist[oó]rico|dossi[eê]|resum|compar|an[aá]lise)\b/i.test(String(query||''));
}
export async function khojLegalContext(query:string,documentText=''){
  if(!shouldUse(query,Boolean(String(documentText||'').trim())))return '';
  try{
    const base=khojBase();
    const client='lexispredict';
    const agent=String(process.env.KHOJ_AGENT_SLUG||'').trim();
    const session=await requestJson(
      base+'/api/chat/sessions?client='+client+(agent?'&agent_slug='+encodeURIComponent(agent):''),
      {method:'POST',headers:headers()},
      6500
    );
    const conversationId=String(session?.conversation_id||'').trim();
    if(!conversationId)return '';
    const prompt=[
      String(query||'').trim(),
      documentText?('\n\nDOCUMENTO FORNECIDO PELO USUÁRIO:\n'+String(documentText).slice(0,9000)):''
    ].join('').slice(0,12000);
    const chat=await requestJson(base+'/api/chat?client='+client,{
      method:'POST',
      headers:headers(),
      body:JSON.stringify({q:prompt,conversation_id:conversationId,stream:false,n:7})
    },9000);
    const answer=String(chat?.response||'').trim();
    if(!answer)return '';
    const refs=(Array.isArray(chat?.references)?chat.references:[])
      .slice(0,8)
      .map((ref:KhojReference,index:number)=>{
        const label=String(ref?.file||ref?.heading||ref?.uri||('referência '+(index+1))).trim();
        const text=String(ref?.compiled||ref?.raw||'').replace(/\s+/g,' ').trim().slice(0,650);
        return text?'['+(index+1)+'] '+label+' — '+text:'['+(index+1)+'] '+label;
      })
      .join('\n');
    return [
      'KHOJ SECOND BRAIN / RAG (contexto externo; valide contra autos e fontes oficiais):',
      answer,
      refs?('REFERÊNCIAS KHOJ:\n'+refs):''
    ].filter(Boolean).join('\n\n').slice(0,6500);
  }catch{
    return '';
  }
}
