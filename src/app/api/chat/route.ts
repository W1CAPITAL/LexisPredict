import { NextResponse } from 'next/server';
import { chatAIFlow } from '@/ai/flows/chat-ai-flow';

/**
 * @fileOverview Handler de Chat IA v1.0
 * Fornece interface HTTP para consultas estratégicas via motores neurais.
 */

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { pergunta, historico, preferredModel } = body;

    const result = await chatAIFlow({
      pergunta,
      historico,
      preferredModel
    });

    // Retorna apenas propriedades existentes no tipo do chatAIFlow
    return NextResponse.json({
      response: result.resposta,
      engine: result.engineUtilizada,
      sucesso: result.sucesso
    });
  } catch (error: any) {
    console.error("[CHAT API ERROR]", error.message);
    return NextResponse.json(
      { sucesso: false, response: "Falha interna no motor neural." },
      { status: 500 }
    );
  }
}
