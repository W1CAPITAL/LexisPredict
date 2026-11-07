import { NextResponse } from 'next/server';
import { getUserContext } from '@/lib/server-db';
import { openHiggsfieldGenerate, openHiggsfieldModels, openHiggsfieldStatus, openHiggsfieldTask } from '@/lib/media/open-higgsfield';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=300;
function reply(data:unknown,status=200){return NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});}
async function admin(){const c=await getUserContext();return Boolean(c.auth_id&&c.isSuperAdmin);}
export async function GET(req:Request){
  if(!await admin())return reply({error:'Acesso restrito ao superadministrador.'},403);
  try{
    const id=new URL(req.url).searchParams.get('task_id');
    if(id)return reply(await openHiggsfieldTask(id));
    const status=await openHiggsfieldStatus();
    const models=status.ready?await openHiggsfieldModels().catch(()=>[]):[];
    return reply({...status,models});
  }catch(e){return reply({error:e instanceof Error?e.message:'Estúdio indisponível.'},502);}
}
export async function POST(req:Request){
  if(!await admin())return reply({error:'Acesso restrito ao superadministrador.'},403);
  if(req.headers.get('origin')!==new URL(req.url).origin||
    ['cross-site','same-site'].includes(req.headers.get('sec-fetch-site')||''))
    return reply({error:'Origem não autorizada.'},403);
  if(!(req.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))
    return reply({error:'Envie JSON.'},415);
  try{
    const raw=await req.text();
    if(Buffer.byteLength(raw)>12000)return reply({error:'Requisição grande demais.'},413);
    const result=await openHiggsfieldGenerate(JSON.parse(raw));
    return reply(result,result.accepted?202:409);
  }catch(e){return reply({error:e instanceof Error?e.message:'Geração não iniciada.'},400);}
}