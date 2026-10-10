import { createClient } from "@supabase/supabase-js";
import {timingSafeEqual} from "node:crypto";
import { NextResponse } from "next/server";
import { resolveWaAutoPermissions } from "@/lib/wa-auto-permissions";

import {verifyWaWorkerIdentity} from '@/lib/wa-worker-auth';
import {getWaAutoConfig} from '@/lib/wa-auto-client';

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

  // Background sends use the same server credential without relying on a
  // browser cookie or requiring WA.Auto and Lexis to share identical tokens.
  if (token.startsWith('lexiswa1.')) {
    const identity=verifyWaWorkerIdentity(token,getWaAutoConfig().integrationToken);
    if(!identity || !serviceKey) return NextResponse.json({ok:false,error:'invalid_worker'},{status:401});
    const db=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:profile}=await db.from('usuarios').select('empresa_id,cargo')
      .eq('auth_user_id',identity.userId).eq('empresa_id',identity.empresaId).maybeSingle();
    const permission=resolveWaAutoPermissions(profile);
    const [{data:settings},{data:campaign}]=await Promise.all([
      db.from('wa_daily_return_settings').select('empresa_id').eq('empresa_id',identity.empresaId)
        .eq('owner_auth_id',identity.userId).eq('enabled',true).maybeSingle(),
      db.from('wa_movement_campaigns').select('id').eq('empresa_id',identity.empresaId)
        .eq('owner_auth_id',identity.userId).eq('status','running').limit(1).maybeSingle(),
    ]);
    if(!profile || !permission.canManage || (!settings && !campaign))
      return NextResponse.json({ok:false,error:'worker_not_authorized'},{status:403});
    return NextResponse.json({ok:true,userId:identity.userId,empresaId:identity.empresaId,
      role:permission.role,canManage:permission.canManage},{headers:{'Cache-Control':'private, no-store'}});
  }


  // WA.Auto sends a private integration credential with x-lexis-user-id.
  // Validate this server credential and the user's live company membership.
  // The former endpoint only recognised JWT/lexiswa1 and rejected this format.
  const {integrationToken} = getWaAutoConfig();
  const actorId = String(request.headers.get("x-lexis-user-id") || "").trim();
  const secondToken = String(request.headers.get("x-wa-integration-token") || "").trim();
  const sharedMatch =
    integrationToken.length >= 24 &&
    token.length === integrationToken.length &&
    timingSafeEqual(Buffer.from(token), Buffer.from(integrationToken));
  if (sharedMatch) {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(actorId) ||
      (secondToken && secondToken !== integrationToken)
    ) {
      return NextResponse.json({ok:false,error:"invalid_worker_identity"},{status:401});
    }
    if (!serviceKey) return NextResponse.json({ok:false,error:"auth_unavailable"},{status:503});
    const db = createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:profile,error:lookupError} = await db.from("usuarios")
      .select("auth_user_id,empresa_id,cargo")
      .eq("auth_user_id",actorId).maybeSingle();
    if (lookupError) return NextResponse.json({ok:false,error:"profile_lookup_failed"},{status:503});
    const permission=resolveWaAutoPermissions(profile);
    if (!profile?.empresa_id || !permission.canManage) {
      return NextResponse.json({ok:false,error:"worker_not_authorized"},{status:403});
    }
    return NextResponse.json({
      ok:true,userId:actorId,empresaId:profile.empresa_id,
      role:permission.role,canManage:true,
    },{headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
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
