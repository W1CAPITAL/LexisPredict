import { NextResponse } from "next/server";
import { getCommercialAccess } from "@/lib/commercial/access";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await getCommercialAccess();
  if (!access.authenticated) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }
  return NextResponse.json(access, { status: access.ok ? 200 : 402 });
}
