import { NextResponse } from 'next/server';
import { getUserContext } from '@/lib/server-db';
import { sheetsWebhookConfigured, sheetsServerPost } from '@/lib/hybrid/sheets-server';
export const runtime='nodejs'; export const dynamic='force-dynamic';
export async function POST(){
 try{
  const ctx=await getUserContext();
  if(!ctx?.empresa_id) return NextResponse.json({ok:false,skipped:true,reason:'empresa-nao-identificada'});
  if(!sheetsWebhookConfigured()) return NextResponse.json({ok:true,skipped:true,reason:'sheets-nao-configurado'});
  // Não copia a carteira inteira na entrada: apenas acorda o adaptador para reconciliação.
  const r=await sheetsServerPost({action:'ping',empresaId:ctx.empresa_id,source:'lexis-entry'});
  return NextResponse.json({ok:true,synced:r?.ok!==false,background:true});
 }catch(e:any){return NextResponse.json({ok:false,error:e?.message||'sync indisponivel'},{status:200});}
}
