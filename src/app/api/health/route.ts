import { NextResponse } from "next/server";

// =============================================================================
// GET /api/health
// Lightweight liveness probe. Returns 200 with build metadata so uptime
// monitors and preview environments can confirm the deployment is up. Does
// not touch external services — a 200 here means "the server is serving."
// =============================================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "sarahs-foundation-web",
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? null,
      env: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
