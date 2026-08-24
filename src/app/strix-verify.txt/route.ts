import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = (process.env.STRIX_VERIFY_TOKEN || "").trim();
  if (!token) {
    return new NextResponse("not configured", { status: 404 });
  }
  return new NextResponse(token, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
