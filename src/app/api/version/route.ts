import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const buildId =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_BUILD_ID ||
    process.env.VERCEL_DEPLOYMENT_ID ||
    "dev";

  return NextResponse.json(
    {
      buildId: String(buildId).slice(0, 40),
      env: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
      ts: Date.now(),
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
