import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { resolveWaAutoPermissions } from "@/lib/wa-auto-permissions";

export const dynamic = "force-dynamic";


export async function GET(request: Request) {
  const url = String(
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      ""
  ).trim();
  const publicKey = String(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      ""
  ).trim();
  const serviceKey = String(
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      ""
  ).trim();

  if (!url || !publicKey) {
    return NextResponse.json(
      { ok: false, error: "auth_unavailable" },
      { status: 503 }
    );
  }

  const auth = request.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "missing_bearer" },
      { status: 401 }
    );
  }

  const verifier = createClient(url, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await verifier.auth.getUser(token);
  const user = userData?.user || null;
  if (userError || !user?.id) {
    return NextResponse.json(
      { ok: false, error: "invalid_session" },
      { status: 401 }
    );
  }

  // Depois de validar o JWT, prefira service role para o perfil. Isso evita
  // falha falsa por RLS da tabela usuarios e mantém compatibilidade com o
  // banco legado da W1.
  const profileClient = serviceKey
    ? createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : createClient(url, publicKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });

  let profile: any = null;
  let profileError: any = null;

  const full = await profileClient
    .from("usuarios")
    .select("auth_user_id, empresa_id, cargo, role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  profile = full.data;
  profileError = full.error;

  // Instalações antigas podem não ter a coluna role.
  if (
    profileError &&
    /role|column .* does not exist|schema cache/i.test(
      String(profileError.message || "")
    )
  ) {
    const legacy = await profileClient
      .from("usuarios")
      .select("auth_user_id, empresa_id, cargo")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    profile = legacy.data;
    profileError = legacy.error;
  }

  if (profileError || !profile) {
    return NextResponse.json(
      {
        ok: false,
        error: profileError ? "profile_lookup_failed" : "profile_not_found",
      },
      { status: profileError ? 503 : 403 }
    );
  }

  // Cargo é autoritativo no Supabase W1. A coluna "role" é legado
  // e está preenchida como "operador" até mesmo no perfil Superadmin.
  // Nunca privilegie um role legado contraditório ao cargo verificado.
  const { role, canManage } = resolveWaAutoPermissions(profile);

  return NextResponse.json(
    {
      ok: true,
      userId: user.id,
      empresaId: profile.empresa_id || null,
      role,
      canManage,
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    }
  );
}
