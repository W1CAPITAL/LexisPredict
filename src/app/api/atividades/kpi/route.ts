import {NextResponse} from 'next/server';
import {loadAtividadesRegistradasKpi} from '@/lib/atividades-kpi-service';

export const dynamic='force-dynamic';
export const revalidate=0;
export const runtime='nodejs';

/**
 * GET do mesmo servidor Next que o EXE executa em 127.0.0.1.
 * Não usa Vercel, chave administrativa ou dados de outra empresa.
 */
export async function GET(){
 const result=await loadAtividadesRegistradasKpi();
 return NextResponse.json(result,{
  status:result.ok?200:result.reason==='unauthenticated'?401:503,
  headers:{
   'Cache-Control':'private, no-store, max-age=0',
   'Vary':'Cookie'
  }
 });
}
