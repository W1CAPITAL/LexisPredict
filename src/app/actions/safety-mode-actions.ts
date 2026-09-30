"use server";

import {
  sheetsAuthLogin,
  sheetsWebhookConfigured,
  sheetsPing,
  sheetsServerPost,
} from "@/lib/hybrid/sheets-server";
import {isQuotaOrBillingError} from "@/lib/hybrid/safety-mode";
import {
  clearSafetySessionServer,
  issueSafetySession,
  readSafetySession,
} from "@/lib/hybrid/safety-session";

export async function probeSupabaseAction(){
  const url=String(process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL||"").trim();
  if(!url)return {ok:false,safety:true,reason:"Supabase sem URL"};
  try{
    const res=await fetch(url.replace(/\/$/,"")+"/auth/v1/health",{
      cache:"no-store",
      headers:{apikey:String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||"")},
      signal:AbortSignal.timeout(4000),
    });
    const body=await res.text().catch(()=>"");
    if(!res.ok||isQuotaOrBillingError(body)||res.status===402||res.status===429){
      return {ok:false,safety:true,reason:body.slice(0,180)||("HTTP "+res.status)};
    }
    return {ok:true,safety:false};
  }catch(e:any){
    return {ok:false,safety:true,reason:e?.message||"Supabase inacessível"};
  }
}

export async function safetyLoginAction(usuario:string,senha:string){
  if(!sheetsWebhookConfigured())return {ok:false,error:"Contingência por planilha não configurada."};
  const login=String(usuario||"").trim();
  if(!login||!senha)return {ok:false,error:"Informe usuário e senha."};
  const auth=await sheetsAuthLogin(login,senha);
  if(!auth.ok)return {ok:false,error:auth.error};
  try{
    const session=await issueSafetySession(auth.user);
    return {
      ok:true as const,
      safety:true,
      user:{login:session.login,nome:session.nome,perfil:session.perfil,email:session.email,escritorio:session.escritorio},
    };
  }catch(e:any){
    return {ok:false as const,error:e?.message||"Não foi possível criar a sessão de contingência."};
  }
}

export async function safetyLogoutAction(){
  await clearSafetySessionServer();
  return {ok:true as const};
}

export async function safetyReplayQueueAction(rows:Array<Record<string,unknown>>){
  const session=await readSafetySession();
  if(!session)return {ok:false as const,written:0,error:"Sessão de contingência inválida."};
  if(!Array.isArray(rows)||!rows.length)return {ok:true as const,written:0};
  const mapped=rows.map(row=>({
    protocolo:String((row as any).protocolo||(row as any).Protocolo||""),
    ...row,
  })).filter(row=>row.protocolo).slice(0,200);
  const wr=await sheetsServerPost({
    action:"upsert_batch",
    rows:mapped,
    source:"LexisPredict Safety",
    actor:session.login,
    actor_name:session.nome,
    perfil:session.perfil,
  });
  return {
    ok:wr.ok as boolean,
    written:Number(wr.json?.written??wr.json?.updated??0),
    error:wr.error,
  };
}

export async function safetyPingSheetsAction(){
  if(!sheetsWebhookConfigured())return {ok:false,error:"Webhook ausente"};
  const p=await sheetsPing();
  return {ok:p.ok,error:p.error};
}
