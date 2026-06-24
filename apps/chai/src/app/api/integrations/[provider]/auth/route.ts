import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildAuthUrl, exchangeCode } from "@/lib/integrations/store";
import type { IntegrationProvider } from "@/lib/types";

export async function GET(
  req: NextRequest,
  { params }: { params: { provider: string } }
) {
  const provider = params.provider as IntegrationProvider;
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }
  try {
    const state = Buffer.from(JSON.stringify({ userId, provider })).toString("base64url");
    const url = buildAuthUrl(provider, state);
    return NextResponse.redirect(url);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "OAuth not configured" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { provider: string } }
) {
  const provider = params.provider as IntegrationProvider;
  const body = await req.json();
  const { code, userId } = body;
  if (!code || !userId) {
    return NextResponse.json({ error: "code and userId required" }, { status: 400 });
  }
  const tokens = await exchangeCode(provider, code);
  const expiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000)
    : null;

  await db.integration.upsert({
    where: { userId_provider: { userId, provider } },
    create: {
      userId,
      provider,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
    },
    update: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || undefined,
      expiresAt,
    },
  });

  return NextResponse.json({ ok: true, provider });
}
