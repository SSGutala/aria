import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { exchangeCode } from "@/lib/integrations/store";
import type { IntegrationProvider } from "@/lib/types";

export async function GET(
  req: NextRequest,
  { params }: { params: { provider: string } }
) {
  const provider = params.provider as IntegrationProvider;
  const code = req.nextUrl.searchParams.get("code");
  const stateRaw = req.nextUrl.searchParams.get("state");
  if (!code || !stateRaw) {
    return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
  }

  let userId: string;
  try {
    const state = JSON.parse(Buffer.from(stateRaw, "base64url").toString());
    userId = state.userId;
  } catch {
    return NextResponse.json({ error: "Invalid state" }, { status: 400 });
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:4321";
  return NextResponse.redirect(`${appUrl}/settings?connected=${provider}`);
}
