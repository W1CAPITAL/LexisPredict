import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const buildId =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_BUILD_ID ||
    process.env.VERCEL_DEPLOYMENT_ID ||
    process.env.NEXT_BUILD_ID ||
    "dev";

  return NextResponse.json(
    {
      buildId: String(buildId).slice(0, 48),
      env: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
      ts: Date.now(),
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    }
  );
}
