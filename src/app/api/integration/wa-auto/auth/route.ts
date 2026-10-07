import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function normalizeRole(value: unknown) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "superadmin") return "Superadmin";
  if (raw === "supervisor") return "Supervisor";
  if (raw === "administrador" || raw === "admin") return "Administrador";
  if (raw === "visualizador" || raw === "viewer") return "Visualizador";
  return "Operador";
}

export async function GET(request: Request) {
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
  if (!url || !key) {
    return NextResponse.json({ ok: false, error: "auth_unavailable" }, { status: 503 });
  }

  const auth = request.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return NextResponse.json({ ok: false, error: "missing_bearer" }, { status: 401 });
  }

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData, error: userError } = await client.auth.getUser(token);
  const user = userData?.user || null;
  if (userError || !user?.id) {
    return NextResponse.json({ ok: false, error: "invalid_session" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await client
    .from("usuarios")
    .select("auth_user_id, empresa_id, cargo, role, ativo")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileError || !profile || profile.ativo === false) {
    return NextResponse.json({ ok: false, error: "profile_not_allowed" }, { status: 403 });
  }

  const role = normalizeRole((profile as any).role || (profile as any).cargo);
  const canManage =
    role === "Superadmin" ||
    role === "Supervisor" ||
    role === "Administrador";

  return NextResponse.json(
    {
      ok: true,
      userId: user.id,
      empresaId: (profile as any).empresa_id || null,
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
