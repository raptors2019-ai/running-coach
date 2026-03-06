import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL("/settings?strava=error", request.url));
  }

  try {
    const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    await client.action(api.strava.exchangeStravaCode, { code });
    return NextResponse.redirect(new URL("/settings?strava=connected", request.url));
  } catch {
    return NextResponse.redirect(new URL("/settings?strava=error", request.url));
  }
}
