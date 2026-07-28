/**
 * @fileOverview Rota de Cron para Varredura DataJud
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import { NextResponse } from 'next/server';
import { runDataJudScanAction } from '@/app/actions/case-actions';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Nota: Esta rota é projetada para ser chamada por um sistema de agendamento (ex: Vercel Cron)
  // Como runDataJudScanAction usa getUserContext(), ela só funcionará aqui se a autenticação
  // for provida ou se adaptarmos a action para aceitar um empresa_id direto via admin key.
  // Para esta versão MVP, a varredura deve ser disparada manualmente via UI por um operador.
  
  return NextResponse.json({ 
    message: "O rito de varredura deve ser iniciado via Mission Control para garantir o contexto multi-tenant." 
  });
}
