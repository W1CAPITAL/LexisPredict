import {NextResponse} from 'next/server';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(){
 const nonce=process.env.LEXIS_DESKTOP_LOCAL_NONCE||'';
 if(process.env.LEXIS_DESKTOP_STANDALONE!=='1'||!/^[a-f0-9]{48}$/.test(nonce)){
  return NextResponse.json({ready:false},{status:404,headers:{'Cache-Control':'no-store'}});
 }
 return NextResponse.json({ready:true,product:'lexispredict',nonce},{headers:{
  'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'
 }});
}
