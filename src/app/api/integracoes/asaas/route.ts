import {NextRequest,NextResponse} from 'next/server';
import {getUserContext} from '@/lib/server-db';
import {W1_EMPRESA_PRINCIPAL_ID} from '@/lib/w1-empresa';
import {mapAsaasPayment} from '@/lib/integracoes-suite';

export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=20;
const headers={'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie','X-Content-Type-Options':'nosniff'};
const fail=(message:string,status:number)=>NextResponse.json({ok:false,error:message},{status,headers});
export async function GET(request:NextRequest){
 const ctx=await getUserContext();
 if(!ctx?.auth_id||!ctx?.empresa_id)return fail('Sessão expirada.',401);
 if(!(ctx.isSuperAdmin||ctx.isSupervisor||ctx.isAdministrador)||ctx.isViewer)return fail('Somente a administração pode consultar o financeiro externo.',403);
 const allowed=String(process.env.ASAAS_ALLOWED_EMPRESA_ID||W1_EMPRESA_PRINCIPAL_ID);
 if(String(ctx.empresa_id).toLowerCase()!==allowed.toLowerCase())return fail('Integração financeira não habilitada para esta empresa.',403);
 const key=process.env.ASAAS_API_KEY;
 if(!key)return fail('Configure ASAAS_API_KEY na Vercel para consultar a conta. Não cole a chave no navegador.',503);
 const env=process.env.ASAAS_ENV==='production'?'production':'sandbox';
 if(env==='production'&&process.env.ASAAS_ALLOW_PRODUCTION_READ!=='true')return fail('Leitura em produção desativada até aprovação de integração.',403);
 const offsetRaw=Number(request.nextUrl.searchParams.get('offset')||0);
 const offset=Number.isSafeInteger(offsetRaw)?Math.max(0,Math.min(10000,offsetRaw)):0;
 const url=new URL((env==='production'?'https://api.asaas.com/v3':'https://api-sandbox.asaas.com/v3')+'/lean/payments');
 url.searchParams.set('limit','15');
 url.searchParams.set('offset',String(offset));
 try{
   const response=await fetch(url,{
     method:'GET',
     headers:{'accept':'application/json','User-Agent':'LexisPredict/2.0 (readonly-finance)','access_token':key},
     cache:'no-store',signal:AbortSignal.timeout(12000),redirect:'error',
   });
   if(!response.ok){
     const message=response.status===401||response.status===403?'A chave Asaas não tem acesso de leitura.':
       response.status===429?'Limite de consultas Asaas alcançado. Tente mais tarde.':'Asaas indisponível para consulta.';
     return fail(message,response.status===429?429:502);
   }
   const payload=await response.json() as {data?:unknown[];totalCount?:number;hasMore?:boolean};
   const payments=(Array.isArray(payload.data)?payload.data:[]).map(mapAsaasPayment).filter((x):x is NonNullable<typeof x>=>!!x);
   return NextResponse.json({ok:true,environment:env,readOnly:true,items:payments,
     totalCount:Number(payload.totalCount)||0,hasMore:payload.hasMore===true,offset,queriedAt:new Date().toISOString()},{headers});
 }catch{
   return fail('Falha de conexão ou tempo esgotado na API do Asaas.',504);
 }
}
