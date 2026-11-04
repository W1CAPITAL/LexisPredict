import {NextRequest,NextResponse} from 'next/server';
import {getUserContext,getSupabaseAdmin} from '@/lib/server-db';
import {decryptCalendarToken,googleCalendarEventPayload,googleCalendarConfigured} from '@/lib/google-calendar-private';
import type {CalendarEventInput} from '@/lib/integracoes-suite';
import {buildCalendarEventUrl} from '@/lib/integracoes-suite';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=25;
const headers={'Cache-Control':'private, no-store','Vary':'Cookie'};
const answer=(data:unknown,status=200)=>NextResponse.json(data,{status,headers});
async function authorizedConnection(){
 const ctx=await getUserContext();
 if(!ctx?.auth_id||!ctx?.empresa_id)return {error:answer({ok:false,error:'Sessão não autenticada.'},401)};
 const db=await getSupabaseAdmin();
 const {data,error}=await db.from('google_calendar_connections').select('refresh_token_ciphertext')
  .eq('empresa_id',ctx.empresa_id).eq('auth_user_id',ctx.auth_id).maybeSingle();
 if(error)return {error:answer({ok:false,error:'A conexão do calendário está indisponível.'},503)};
 return {ctx,db,data};
}
async function googleAccessToken(ciphertext:string,company:string,user:string):Promise<string>{
 const key=process.env.GOOGLE_CALENDAR_ENCRYPTION_KEY||'';
 const refresh=decryptCalendarToken(ciphertext,company+':'+user,key);
 const payload=new URLSearchParams({
   refresh_token:refresh,client_id:process.env.GOOGLE_CALENDAR_CLIENT_ID||'',
   client_secret:process.env.GOOGLE_CALENDAR_CLIENT_SECRET||'',grant_type:'refresh_token',
 });
 const res=await fetch('https://oauth2.googleapis.com/token',{
   method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
   body:payload,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(9000),
 });
 if(!res.ok)throw new Error('REFRESH_DENIED');
 const data=await res.json() as {access_token?:string};
 if(!data.access_token)throw new Error('REFRESH_DENIED');
 return data.access_token;
}
export async function GET(request:NextRequest){
 const connection=await authorizedConnection();
 if(connection.error)return connection.error;
 const configured=googleCalendarConfigured();
 if(request.nextUrl.searchParams.get('status')==='1')return answer({
   ok:true,connected:!!connection.data,configured,mode:'user_oauth'
 });
 if(!configured)return answer({ok:false,error:'Google OAuth não configurado no servidor.'},503);
 if(!connection.data)return answer({ok:false,error:'Conecte sua conta Google antes de consultar eventos.'},409);
 try{
   const ctx=connection.ctx!;
   const token=await googleAccessToken(connection.data.refresh_token_ciphertext,String(ctx.empresa_id),String(ctx.auth_id));
   const url=new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
   url.searchParams.set('timeMin',new Date().toISOString());
   url.searchParams.set('singleEvents','true');url.searchParams.set('orderBy','startTime');url.searchParams.set('maxResults','15');
   const res=await fetch(url,{headers:{Authorization:'Bearer '+token},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});
   if(!res.ok)return answer({ok:false,error:'Google Agenda recusou a consulta. Reconecte sua conta.'},502);
   const json=await res.json() as {items?:Array<Record<string,unknown>>};
   const items=(json.items||[]).slice(0,15).map(item=>({
      id:String(item.id||'').slice(0,100),summary:String(item.summary||'').slice(0,150),
      when:String((item.start as any)?.dateTime||(item.start as any)?.date||'').slice(0,35),
      link:typeof item.htmlLink==='string'&&item.htmlLink.startsWith('https://calendar.google.com/')?item.htmlLink:null
   }));
   return answer({ok:true,items,readOnly:true});
 }catch{
   return answer({ok:false,error:'Não foi possível consultar o Google Agenda. Verifique a autorização e tente novamente.'},502);
 }
}
export async function POST(request:NextRequest){
 const origin=request.headers.get('origin');
 if(origin&&origin!==request.nextUrl.origin)return answer({ok:false,error:'Origem não autorizada.'},403);
 const connection=await authorizedConnection();
 if(connection.error)return connection.error;
 if(!googleCalendarConfigured())return answer({ok:false,error:'Google OAuth ainda não configurado.'},503);
 if(!connection.data)return answer({ok:false,error:'Conecte seu Google Agenda primeiro.'},409);
 const body=await request.json().catch(()=>null);
 if(!body||!body.event||typeof body.event!=='object')return answer({ok:false,error:'Compromisso não informado.'},400);
 const raw=body.event as CalendarEventInput;
 const event:CalendarEventInput={
  title:String(raw.title||'').slice(0,180),date:String(raw.date||'').slice(0,10),
  time:String(raw.time||'').slice(0,5),cnj:String(raw.cnj||'').slice(0,35),
  notes:String(raw.notes||'').slice(0,400),durationMinutes:Math.min(240,Math.max(15,Number(raw.durationMinutes)||60))
 };
 try{buildCalendarEventUrl(event);}catch{return answer({ok:false,error:'Título, data ou horário inválidos.'},400);}
 try{
   const ctx=connection.ctx!;
   const token=await googleAccessToken(connection.data.refresh_token_ciphertext,String(ctx.empresa_id),String(ctx.auth_id));
   const payload=googleCalendarEventPayload(String(ctx.auth_id),event);
   const url='https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=none';
   const res=await fetch(url,{
     method:'POST',
     headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','Accept':'application/json'},
     body:JSON.stringify(payload),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000),
   });
   if(res.status===409)return answer({ok:true,alreadyExists:true,message:'Este compromisso já estava cadastrado na sua Agenda Google.'});
   if(!res.ok)return answer({ok:false,error:'Google Agenda recusou a criação. Confira permissões e horário.'},502);
   const data=await res.json() as {htmlLink?:string;id?:string};
   const link=typeof data.htmlLink==='string'&&data.htmlLink.startsWith('https://calendar.google.com/')?data.htmlLink:null;
   return answer({ok:true,created:true,id:String(data.id||'').slice(0,100),url:link});
 }catch{return answer({ok:false,error:'Não foi possível criar o evento. Verifique a conexão Google.'},502);}
}
export async function DELETE(request:NextRequest){
 const origin=request.headers.get('origin');
 if(origin&&origin!==request.nextUrl.origin)return answer({ok:false,error:'Origem não autorizada.'},403);
 const connection=await authorizedConnection();
 if(connection.error)return connection.error;
 const ctx=connection.ctx!;
 const {error}=await connection.db!.from('google_calendar_connections').delete()
  .eq('empresa_id',ctx.empresa_id).eq('auth_user_id',ctx.auth_id);
 if(error)return answer({ok:false,error:'Não foi possível desconectar a Agenda.'},503);
 return answer({ok:true,connected:false,notice:'Autorização apagada do LexisPredict; eventos já existentes foram preservados.'});
}
