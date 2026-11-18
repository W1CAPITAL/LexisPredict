import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {openCodeRelayRequest,RELAY_ORIGIN} from '@/lib/ai/opencode-relay-policy';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const reply=(body:unknown,status:number)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private,no-store','X-Content-Type-Options':'nosniff'}});
export async function POST(request:NextRequest){
 try{
  if(!request.headers.get('content-type')?.includes('application/json'))return reply({error:'JSON obrigatório.'},400);
  if(Number(request.headers.get('content-length')||0)>40000)return reply({error:'Solicitação muito grande.'},400);
  const token=(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim();
  if(!token)return reply({error:'Entre no LexisPredict.'},401);
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!key)return reply({error:'Conexão Supabase indisponível.'},503);
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:'Bearer '+token}}});
  const {data:{user},error}=await db.auth.getUser(token);
  if(error||!user||user.is_anonymous)return reply({error:'Sessão inválida ou expirada.'},401);
  const raw=await request.text();
  if(raw.length>40000)return reply({error:'Solicitação muito grande.'},400);
  const spec=openCodeRelayRequest(JSON.parse(raw));
  const upstream=await fetch(RELAY_ORIGIN+spec.path,{
   method:spec.method,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000),
   headers:{Authorization:'Bearer '+token,Accept:'application/json',...(spec.body?{'Content-Type':'application/json'}:{})},
   body:spec.body?JSON.stringify(spec.body):undefined
  });
  const text=await upstream.text();
  if(text.length>68000)return reply({error:'Resposta remota excedeu o limite.'},502);
  const payload=JSON.parse(text);
  const status=[200,400,401,403,404,409,413,429,503].includes(upstream.status)?upstream.status:502;
  return reply(payload,status);
 }catch(error){
  return reply({error:'Ponte MCP indisponível ou solicitação inválida. Confira pareamento e permissões.'},503);
 }
}
