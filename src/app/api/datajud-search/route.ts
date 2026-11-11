/** Proxy autenticado do DataJud público — apenas consulta por CNJ.
 * Nome/CPF/CNPJ: pesquise primeiro na carteira da empresa, sem enviar dados
 * pessoais para a API Pública do CNJ (campos não suportados pelo índice).
 */
import {NextResponse} from 'next/server';
import {fetchDataJud} from '@/lib/datajud';
import {getUserContext} from '@/lib/server-db';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
const headers={'Cache-Control':'private, no-store','Vary':'Cookie'};

export async function POST(request:Request){
 try{
  const ctx=await getUserContext();
  if(!ctx?.auth_id||!ctx?.empresa_id)return NextResponse.json(
   {success:false,items:[],error:'Sessão não autorizada.'},{status:401,headers}
  );
  const body=await request.json().catch(()=>({}));
  const mode=String(body.mode||'');
  const raw=String(body.query||'').trim();
  if(mode==='cpf'||mode==='nome'||mode==='cnpj')return NextResponse.json({
   success:false,items:[],
   error:'A API pública DataJud não pesquisa partes por nome, CPF ou CNPJ. Use a busca empresarial e consulte o tribunal pelo CNJ.'
  },{status:422,headers});
  if(mode!=='cnj')return NextResponse.json({success:false,error:'Modo inválido.'},{status:400,headers});
  const cnj=raw.replace(/\D/g,'');
  if(cnj.length!==20)return NextResponse.json({success:false,error:'CNJ inválido.'},{status:400,headers});
  const result=await fetchDataJud(cnj,1,{fast:true,cloudBudget:true,timeoutMs:25_000});
  return NextResponse.json({
    success:result.error===false&&result.found===true,
    data:result,
    error:result.error?result.message:undefined
  },{headers});
 }catch{
  return NextResponse.json({success:false,error:'Consulta DataJud indisponível.'},{status:503,headers});
 }
}
