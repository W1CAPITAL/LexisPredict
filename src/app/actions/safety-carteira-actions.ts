"use server";

import {sheetsListProcessos} from "@/lib/hybrid/sheets-server";
import {sheetRowsToLegalCases} from "@/lib/hybrid/sheets-case-map";
import {readSafetySession} from "@/lib/hybrid/safety-session";

function norm(v:unknown){
  return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase();
}

export async function listSafetyCarteiraAction(){
  const session=await readSafetySession();
  if(!session){
    return {ok:false,error:"Sessão de contingência expirada.",totalPlanilha:0,totalVisivel:0,nome:"",rows:[] as any[]};
  }
  const role=norm(session.perfil);
  const wide=/superadmin|supervisor|administrador|admin/.test(role);
  const listed=await sheetsListProcessos({
    limit:8000,
    responsavel:wide?undefined:session.login,
  });
  const cases=sheetRowsToLegalCases(listed.rows||[]);
  let visible=cases;
  if(!wide){
    const keys=[session.login,session.nome,session.email].map(norm).filter(Boolean);
    const owned=cases.filter((c:any)=>{
      const owner=norm(c.atendente||c.created_by||(c as any).Assistente||(c as any).Responsavel);
      return !owner||keys.some(k=>owner===k||owner.includes(k)||k.includes(owner));
    });
    if(owned.length)visible=owned;
  }
  return {
    ok:listed.ok,
    error:listed.error||"",
    totalPlanilha:cases.length,
    totalVisivel:visible.length,
    nome:session.nome||session.login,
    perfil:session.perfil,
    rows:visible.slice(0,8000),
  };
}
