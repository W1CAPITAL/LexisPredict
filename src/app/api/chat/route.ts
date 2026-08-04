import { NextRequest, NextResponse } from 'next/server';
import { chatAIFlow } from '@/ai/flows/chat-ai-flow';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await chatAIFlow({
      pergunta: body.pergunta || body.message || body.prompt || '',
      historico: body.historico || body.history,
      preferred: body.preferred || body.preferredModel || body.model || 'claude',
      preferredModel: body.preferredModel || body.model,
      tribunalContext: body.tribunalContext,
      baClaudeDjen: !!body.baClaudeDjen,
      images: body.images,
    });
    return NextResponse.json(res);
  } catch (e: any) {
    return NextResponse.json(
      { sucesso: false, resposta: e?.message || 'Erro', engineUtilizada: 'ERROR' },
      { status: 500 }
    );
  }
}
