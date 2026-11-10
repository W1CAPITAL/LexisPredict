import { NextResponse } from 'next/server';
import { getUserContext } from '@/lib/server-db';
import { getHermesCompanyDaily,getHermesCaseHealth,runHermesCompanyMeeting,todayHermesBrazil } from '@/lib/hermes-company-service';
import { buildHermesOfficeIntelligence } from '@/lib/hermes-company-intelligence';

export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=45;
const headers={'Cache-Control':'private, no-store','Vary':'Cookie'};
const isAllowed=(ctx:Awaited<ReturnType<typeof getUserContext>>)=>
 !!ctx?.auth_id && !!ctx?.empresa_id && !ctx?.isViewer &&
 (ctx.isSupervisor||ctx.isSuperAdmin||ctx.isAdministrador);
export async function GET(){
 const ctx=await getUserContext();
 if(!isAllowed(ctx))return NextResponse.json({ok:false,error:'Acesso restrito à supervisão.'},{status:403,headers});
 try{
   const [record,cases]=await Promise.all([getHermesCompanyDaily(String(ctx.empresa_id)),getHermesCaseHealth(String(ctx.empresa_id))]);
   return NextResponse.json({ok:true,record,cases,intelligence:record?
     buildHermesOfficeIntelligence(record.metrics,record.day):null},{headers});
 }catch{
   return NextResponse.json({ok:false,error:'Relatório Hermes indisponível.'},{status:503,headers});
 }
}
export async function POST(){
 const ctx=await getUserContext();
 if(!isAllowed(ctx))return NextResponse.json({ok:false,error:'Acesso restrito à supervisão.'},{status:403,headers});
 try{
   const row=await getHermesCompanyDaily(String(ctx.empresa_id));
   if(!row||row.day!==todayHermesBrazil()) return NextResponse.json({
     ok:false,error:'O snapshot do dia ainda não está disponível. Aguarde a rotina do servidor.'
   },{status:409,headers});
   const result=await runHermesCompanyMeeting(String(ctx.empresa_id),row.day);
   return NextResponse.json(result,{headers});
 }catch{
   return NextResponse.json({ok:false,error:'Reunião indisponível. Os dados existentes permanecem preservados.'},
     {status:503,headers});
 }
}
