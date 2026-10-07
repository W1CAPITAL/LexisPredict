import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !key) {
    return NextResponse.json(
      { ok: false, error: 'Supabase não configurado no servidor.' },
      { status: 503 }
    );
  }

  let body: any = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Requisição inválida.' }, { status: 400 });
  }

  const email = String(body?.email || '').trim().toLowerCase();
  const password = String(body?.password || '');

  if (!email || !password) {
    return NextResponse.json(
      { ok: false, error: 'Informe e-mail e senha.' },
      { status: 400 }
    );
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user || !data.session) {
      const rawStatus = Number((error as any)?.status || 401);
      const status = rawStatus === 429 ? 429 : rawStatus >= 500 ? 503 : 401;
      return NextResponse.json(
        {
          ok: false,
          error: status === 401 ? 'E-mail ou senha inválidos.' : String(error?.message || 'Falha ao autenticar.'),
        },
        { status }
      );
    }

    cookieStore.set('lexis_user_email', String(data.user.email || email).toLowerCase(), {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      httpOnly: false,
    });

    // Decide o primeiro destino no mesmo servidor que acabou de criar a sessão.
    // O middleware continuará sendo a autoridade final de ACL/assinatura.
    let destination = '/';
    try {
      const { data: profile, error: profileError } = await supabase
        .from('usuarios')
        .select('empresa_id, cargo, role')
        .eq('auth_user_id', data.user.id)
        .maybeSingle();

      if (!profileError && !profile) {
        destination = '/setup-empresa';
      } else if (!profileError && profile) {
        const role = String((profile as any).role || (profile as any).cargo || '').toLowerCase();
        const isSuperAdmin = role === 'superadmin';
        if (!isSuperAdmin && !(profile as any).empresa_id) destination = '/setup-empresa';
        if (String((profile as any).cargo || '').toLowerCase() === 'operador') destination = '/cases';
      }
    } catch {
      // Se o lookup do perfil falhar, a sessão continua válida e o middleware decide.
    }

    return NextResponse.json({ ok: true, destination });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: String(error?.message || 'Falha de rede ao autenticar.') },
      { status: 503 }
    );
  }
}
