import {NextRequest,NextResponse} from 'next/server';
import {timingSafeEqual} from 'node:crypto';
import {getUserContext,getSupabaseAdmin} from '@/lib/server-db';
import {encryptCalendarToken,googleCalendarConfigured} from '@/lib/google-calendar-private';
export const runtime='nodejs';
export const dynamic='force-dynamic';
function safeEqual(a:string,b:string):boolean{
 const aBuf=Buffer.from(a),bBuf=Buffer.from(b);
 return aBuf.length===bBuf.length&&timingSafeEqual(aBuf,bBuf);
}
export async function GET(request:NextRequest){
 const next=(status:string)=>{
   const dest=new URL('/integracoes',request.nextUrl.origin);
   dest.searchParams.set('google',status);
   dest.hash='agenda-google';
   const res=NextResponse.redirect(dest,{headers:{'Cache-Control':'no-store'}});
   res.cookies.set('lexis_google_calendar_state','',{httpOnly:true,secure:true,path:'/api/integracoes/calendar',maxAge:0,sameSite:'lax'});
   return res;
 };
 const state=String(request.nextUrl.searchParams.get('state')||'');
 const cookie=request.cookies.get('lexis_google_calendar_state')?.value||'';
 const [nonce,owner,company]=cookie.split('|');
 if(!state||!nonce||!owner||!company||!safeEqual(state,nonce))return next('invalid_state');
 const ctx=await getUserContext();
 if(!ctx?.auth_id||!ctx.empresa_id||ctx.auth_id!==owner||String(ctx.empresa_id)!==company)return next('session_changed');
 if(request.nextUrl.searchParams.has('error'))return next('consent_declined');
 if(!googleCalendarConfigured())return next('not_configured');
 const code=String(request.nextUrl.searchParams.get('code')||'');
 if(!code||code.length>4096)return next('invalid_code');
 try{
   const payload=new URLSearchParams({
     code,client_id:process.env.GOOGLE_CALENDAR_CLIENT_ID||'',
     client_secret:process.env.GOOGLE_CALENDAR_CLIENT_SECRET||'',
     redirect_uri:process.env.GOOGLE_CALENDAR_REDIRECT_URI||'',
     grant_type:'authorization_code',
   });
   const response=await fetch('https://oauth2.googleapis.com/token',{
     method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
     body:payload,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(12000),
   });
   if(!response.ok)return next('token_exchange_failed');
   const token=await response.json() as {refresh_token?:string;scope?:string};
   if(!String(token.scope||'').includes('https://www.googleapis.com/auth/calendar.events'))return next('missing_scope');
   const db=await getSupabaseAdmin();
   let refresh=String(token.refresh_token||'');
   if(!refresh){
     const {data:previous}=await db.from('google_calendar_connections').select('refresh_token_ciphertext')
       .eq('empresa_id',company).eq('auth_user_id',owner).maybeSingle();
     if(!previous?.refresh_token_ciphertext)return next('missing_refresh');
     // Keep previously stored ciphertext, no need to decrypt until the next event.
     const {error}=await db.from('google_calendar_connections').update({
       scope:'https://www.googleapis.com/auth/calendar.events',updated_at:new Date().toISOString()
     }).eq('empresa_id',company).eq('auth_user_id',owner);
     return next(error?'save_failed':'connected');
   }
   const aad=company+':'+owner;
   const encrypted=encryptCalendarToken(refresh,aad,process.env.GOOGLE_CALENDAR_ENCRYPTION_KEY||'');
   refresh=''; // never log provider tokens
   const {error}=await db.from('google_calendar_connections').upsert({
     empresa_id:company,auth_user_id:owner,refresh_token_ciphertext:encrypted,
     scope:'https://www.googleapis.com/auth/calendar.events',updated_at:new Date().toISOString(),
   },{onConflict:'empresa_id,auth_user_id'});
   return next(error?'save_failed':'connected');
 }catch{return next('provider_unavailable');}
}
