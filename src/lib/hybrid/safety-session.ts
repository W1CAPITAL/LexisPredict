import {createHmac,timingSafeEqual} from "node:crypto";
import {cookies} from "next/headers";

const COOKIE="lexis_safety_session";

export type ServerSafetySession={
  login:string;
  nome:string;
  perfil:string;
  email?:string;
  escritorio?:string;
  exp:number;
};

function secret(){
  return String(
    process.env.LEXIS_SAFETY_SESSION_SECRET ||
    process.env.LEXIS_SHEETS_TOKEN ||
    process.env.SHEETS_TOKEN ||
    ""
  ).trim();
}

function sign(encoded:string){
  const key=secret();
  if(!key)throw new Error("Contingência não configurada.");
  return createHmac("sha256",key).update(encoded).digest("hex");
}

export async function issueSafetySession(user:{login?:string;nome?:string;perfil?:string;email?:string;escritorio?:string}){
  const payload:ServerSafetySession={
    login:String(user.login||user.email||"").trim(),
    nome:String(user.nome||user.login||"").trim(),
    perfil:String(user.perfil||"operador").trim(),
    email:String(user.email||"").trim()||undefined,
    escritorio:String(user.escritorio||"").trim()||undefined,
    exp:Date.now()+8*60*60*1000,
  };
  if(!payload.login)throw new Error("Usuário de contingência inválido.");
  const encoded=Buffer.from(JSON.stringify(payload),"utf8").toString("base64url");
  const value=encoded+"."+sign(encoded);
  const jar=await cookies();
  jar.set(COOKIE,value,{
    httpOnly:true,
    secure:process.env.NODE_ENV==="production",
    sameSite:"lax",
    path:"/",
    maxAge:8*60*60,
  });
  return payload;
}

export async function readSafetySession():Promise<ServerSafetySession|null>{
  const raw=(await cookies()).get(COOKIE)?.value||"";
  const [encoded,sig]=raw.split(".");
  if(!encoded||!sig||!/^[a-f0-9]{64}$/i.test(sig))return null;
  let expected="";
  try{expected=sign(encoded)}catch{return null}
  const a=Buffer.from(sig,"hex"),b=Buffer.from(expected,"hex");
  if(a.length!==b.length||!timingSafeEqual(a,b))return null;
  try{
    const payload=JSON.parse(Buffer.from(encoded,"base64url").toString("utf8")) as ServerSafetySession;
    if(!payload?.login||!payload?.exp||payload.exp<Date.now())return null;
    return payload;
  }catch{return null}
}

export async function clearSafetySessionServer(){
  const jar=await cookies();
  jar.set(COOKIE,"",{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:0});
}
