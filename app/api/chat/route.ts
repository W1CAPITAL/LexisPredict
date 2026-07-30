/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */
import { NextRequest, NextResponse } from 'next/server';
import { perguntarIA } from '@/ai/flows/chat-ai-flow';

export const maxDuration = 300; // Define 5 minutos de execução para o Vercel

export async function POST(req: NextRequest) {
  try {
    const { messages, model } = await req.json();
    
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ response: "Formato de mensagem inválido." }, { status: 400 });
    }

    const lastUserMessage = messages[messages.length - 1]?.content || "";

    // Execução via Flow Genkit
    const result = await perguntarIA({
      pergunta: lastUserMessage,
      historico: messages.slice(0, -1),
      preferredModel: model
    });

    // Se a IA retornar uma falha de configuração, reportamos status 200 com a mensagem para não quebrar o front
    return NextResponse.json({ 
      response: result.resposta, 
      engine: result.engineUtilizada,
      unlocked: result.unlocked || false
    });

  } catch (error: any) {
    console.error("[Chat API Critical Fail]", error.message);
    return NextResponse.json({ 
      response: "A Unidade Neural está temporariamente instável devido a falhas de rede ou chaves expiradas." 
    }, { status: 500 });
  }
}
