import {NextResponse} from 'next/server';
import bacenHandler from '@/lib/legacy-services/bacen-sgs';
import inboundHandler from '@/lib/legacy-services/inbound-lead';

export const runtime='nodejs';
export const dynamic='force-dynamic';
// O Next.js pode empacotar este gateway com as rotas de mesma configuração.
// A pasta raiz api/ gerava duas funções Vercel independentes.
export const maxDuration=15;

type LegacyResponse={
 setHeader:(key:string,value:string)=>void;
 status:(code:number)=>LegacyResponse;
 json:(body:unknown)=>void;
};

/** Adapter preserva status, payload e Cache-Control dos handlers existentes.
 * Não reenvia a requisição para o próprio domínio e não cria novas credenciais.
 */
async function executeLegacy(
 req:Request,
 service:'bacen'|'inbound',
 body?:unknown,
):Promise<Response>{
 const headers=new Headers();
 let statusCode=200;
 let payload:unknown={error:'Resposta do serviço indisponível'};
 const response:LegacyResponse={
  setHeader:(key,value)=>{headers.set(key,value);},
  status:(code)=>{statusCode=code;return response;},
  json:(value)=>{payload=value;},
 };
 if(service==='bacen'){
  const query:Record<string,string>={};
  new URL(req.url).searchParams.forEach((value,key)=>{query[key]=value});
  await bacenHandler({method:req.method,query},response);
 }else{
  const allHeaders:Record<string,string>={};
  req.headers.forEach((value,key)=>{allHeaders[key]=value});
  await inboundHandler({method:req.method,body,headers:allHeaders},response);
 }
 return NextResponse.json(payload,{status:statusCode,headers});
}

export async function GET(request:Request){
 if(new URL(request.url).searchParams.get('service')!=='bacen'){
  return NextResponse.json({error:'Serviço não encontrado'},{status:404,headers:{'Cache-Control':'no-store'}});
 }
 return executeLegacy(request,'bacen');
}

export async function POST(request:Request){
 if(new URL(request.url).searchParams.get('service')!=='inbound'){
  return NextResponse.json({error:'Serviço não encontrado'},{status:404,headers:{'Cache-Control':'no-store'}});
 }
 let body:unknown;
 try{body=await request.json();}catch{
  return NextResponse.json({error:'JSON inválido'},{status:400,headers:{'Cache-Control':'no-store'}});
 }
 return executeLegacy(request,'inbound',body);
}
