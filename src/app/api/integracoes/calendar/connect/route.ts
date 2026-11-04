import {NextRequest,NextResponse} from 'next/server';
import {randomBytes} from 'node:crypto';
import {getUserContext} from '@/lib/server-db';
import {googleCalendarConfigured} from '@/lib/google-calendar-private';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const fail=(message:string,status:number)=>NextResponse.json({ok:false,error:message},{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request:NextRequest){
 const ctx=await getUserContext();
 if(!ctx?.auth_id||!ctx?.empresa_id)return fail('Entre no LexisPredict antes de conectar o Google.',401);
 if(!googleCalendarConfigured())return fail('OAuth Google ainda não está configurado pelo administrador.',503);
 const redirect=process.env.GOOGLE_CALENDAR_REDIRECT_URI||'';
 let callback:URL;
 try{callback=new URL(redirect);}catch{return fail('Endereço de retorno OAuth inválido.',503);}
 if(callback.protocol!=='https:'||callback.origin!==request.nextUrl.origin)
  return fail('Configure GOOGLE_CALENDAR_REDIRECT_URI com o mesmo domínio HTTPS aberto.',503);
 const state=randomBytes(32).toString('hex');
 const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
 url.searchParams.set('client_id',process.env.GOOGLE_CALENDAR_CLIENT_ID||'');
 url.searchParams.set('redirect_uri',callback.href);
 url.searchParams.set('response_type','code');
 url.searchParams.set('scope','https://www.googleapis.com/auth/calendar.events');
 url.searchParams.set('access_type','offline');
 url.searchParams.set('prompt','consent');
 url.searchParams.set('state',state);
 const response=NextResponse.redirect(url,{headers:{'Cache-Control':'no-store'}});
 response.cookies.set('lexis_google_calendar_state',state,{
   httpOnly:true,secure:true,sameSite:'lax',path:'/api/integracoes/calendar',maxAge:600
 });
 return response;
}
