/**
 * Chat IA — somente usuário autenticado (cookie Supabase).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { chatAIFlow } from '@/ai/flows/chat-ai-flow';

export const runtime = 'nodejs';

async function requireUser(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const supabase = createServerClient(url, key, {
    cookies: {
      get(name: string) {
        return req.cookies.get(name)?.value;
      },
      set() {},
      remove() {},
    },
  });
  const { data } = await supabase.auth.getUser();
  return data.user || null;
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
      { sucesso: false, resposta: 'Erro ao processar', engineUtilizada: 'ERROR' },
      { status: 500 }
    );
  }
}
