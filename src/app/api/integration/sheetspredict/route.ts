import crypto from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {chatAIFlow} from '@/ai/flows/chat-ai-flow';
import {fetchDataJud,searchDataJudByCpf,searchDataJudByNome} from '@/lib/datajud';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;

function configuredKey(){
  return String(process.env.LEXISPREDICT_API_KEY||'').trim();
}
function bearer(req:NextRequest){
  const raw=String(req.headers.get('authorization')||'');
  return raw.toLowerCase().startsWith('bearer ')?raw.slice(7).trim():'';
}
function sameSecret(a:string,b:string){
  if(!a||!b)return false;
  const aa=Buffer.from(a),bb=Buffer.from(b);
  return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb);
}
function requireService(req:NextRequest){
  const expected=configuredKey();
  if(!expected)return NextResponse.json({ok:false,error:'Integração de serviço indisponível.'},{status:503});
  if(!sameSecret(bearer(req),expected))return NextResponse.json({ok:false,error:'Unauthorized'},{status:401});
  return null;
}
function clean(value:unknown,max=12000){
  return String(value??'').replace(/\u0000/g,'').trim().slice(0,max);
}
function serviceInfo(){
  return {
    ok:true,
    service:'lexispredict',
    capabilities:['datajud','chat'],
    tenantDataExposed:false
  };
}

export async function GET(req:NextRequest){
  const denied=requireService(req);if(denied)return denied;
  return NextResponse.json(serviceInfo(),{headers:{'Cache-Control':'no-store'}});
}

export async function POST(req:NextRequest){
  const denied=requireService(req);if(denied)return denied;
  try{
    const body=await req.json().catch(()=>({}));
    const action=clean(body.action,40).toLowerCase();

    if(action==='status'||action==='capabilities'){
      return NextResponse.json(serviceInfo(),{headers:{'Cache-Control':'no-store'}});
    }

    if(action==='datajud'){
      const mode=clean(body.mode,20).toLowerCase();
      const query=clean(body.query,240);
      if(!query)return NextResponse.json({ok:false,error:'Query vazia.'},{status:400});
      if(mode==='cpf'){
        const result=await searchDataJudByCpf(query,{onlyBA:!!body.onlyBA,size:Math.max(1,Math.min(25,Number(body.size)||12))});
        return NextResponse.json({ok:true,mode,result},{headers:{'Cache-Control':'no-store'}});
      }
      if(mode==='nome'){
        const result=await searchDataJudByNome(query,{size:Math.max(1,Math.min(25,Number(body.size)||12))});
        return NextResponse.json({ok:true,mode,result},{headers:{'Cache-Control':'no-store'}});
      }
      if(mode==='cnj'){
        const result=await fetchDataJud(query,1,{fast:false});
        return NextResponse.json({ok:!result.error,mode,result,error:result.message},{headers:{'Cache-Control':'no-store'}});
      }
      return NextResponse.json({ok:false,error:'Modo inválido.'},{status:400});
    }

    if(action==='chat'){
      const prompt=clean(body.prompt||body.message,18000);
      if(!prompt)return NextResponse.json({ok:false,error:'Mensagem vazia.'},{status:400});
      const result=await chatAIFlow({
        pergunta:prompt,
        historico:Array.isArray(body.history)?body.history.slice(-10):undefined,
        preferred:clean(body.preferred||'claude',80),
        preferredModel:clean(body.preferredModel,120)||undefined,
        tribunalContext:clean(body.tribunalContext,12000)||undefined,
        baClaudeDjen:!!body.baClaudeDjen
      });
      return NextResponse.json({ok:true,result},{headers:{'Cache-Control':'no-store'}});
    }

    return NextResponse.json({ok:false,error:'Ação desconhecida.'},{status:400});
  }catch{
    return NextResponse.json({ok:false,error:'Falha na integração de serviço.'},{status:500});
  }
}
