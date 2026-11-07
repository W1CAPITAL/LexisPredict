import { getUserContext } from '@/lib/server-db';
import { openHiggsfieldDownload } from '@/lib/media/open-higgsfield';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){
  const ctx=await getUserContext();
  if(!ctx.auth_id||!ctx.isSuperAdmin)return Response.json({error:'Acesso negado.'},{status:403});
  const taskId=new URL(request.url).searchParams.get('task_id')||'';
  try{
    const media=await openHiggsfieldDownload(taskId);
    return new Response(media.body,{headers:{
      'Content-Type':media.headers.get('content-type')||'video/mp4',
      'Content-Disposition':'attachment; filename="w1-studio-'+taskId+'.mp4"',
      'Cache-Control':'private, no-store',
      'X-Content-Type-Options':'nosniff',
    }});
  }catch(e){return Response.json({error:e instanceof Error?e.message:'Download indisponível.'},{status:502});}
}