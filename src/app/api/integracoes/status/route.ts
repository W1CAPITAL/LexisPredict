import {NextResponse} from 'next/server';
import {getUserContext} from '@/lib/server-db';
import {W1_EMPRESA_PRINCIPAL_ID} from '@/lib/w1-empresa';
import {googleCalendarConfigured} from '@/lib/google-calendar-private';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const headers={'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie'};
export async function GET(){
 const ctx=await getUserContext();
 if(!ctx?.auth_id||!ctx?.empresa_id)return NextResponse.json({ok:false,error:'Entre na sua conta.'},{status:401,headers});
 const company=String(ctx.empresa_id);
 const allowed=String(process.env.ASAAS_ALLOWED_EMPRESA_ID||W1_EMPRESA_PRINCIPAL_ID);
 const asaasConfigured=company.toLowerCase()===allowed.toLowerCase()&&!!process.env.ASAAS_API_KEY;
 const assinafyAllowed=String(process.env.ASSINAFY_ALLOWED_EMPRESA_ID||W1_EMPRESA_PRINCIPAL_ID);
 const assinafyAccess=(ctx.isSuperAdmin||ctx.isSupervisor||ctx.isAdministrador)&&!ctx.isViewer;
 const assinafyConfigured=assinafyAccess&&company.toLowerCase()===assinafyAllowed.toLowerCase()&&
   !!process.env.ASSINAFY_API_KEY&&!!process.env.ASSINAFY_ACCOUNT_ID;
 return NextResponse.json({ok:true,services:{
    whatsapp:{available:true,mode:'WhatsApp Web + módulos Lexis existentes',automatic:false},
    calendar:{available:true,mode:'Google Agenda via confirmação + conexão OAuth opcional',oauthConfigured:googleCalendarConfigured()},
    asaas:{available:asaasConfigured,mode:process.env.ASAAS_ENV==='production'?'production':'sandbox',readOnly:true},
    assinafy:{available:assinafyConfigured,mode:'Preparo de PDF com revisão',automaticSignatures:false},
    judiciary:{available:true,mode:'Carteira autenticada + DJEN público',searchByOabCrossCourt:false},
    ai:{available:true,mode:'Superagente LexisPredict',automaticDecision:false}
  },financialAccess:ctx.isSuperAdmin||ctx.isSupervisor||ctx.isAdministrador},{headers});
}
