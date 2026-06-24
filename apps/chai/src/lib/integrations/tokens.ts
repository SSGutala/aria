import { db } from "@/lib/db";
import type { IntegrationProvider } from "@/lib/types";
import { refreshAccessToken } from "./store";

export async function getIntegration(userId: string, provider: IntegrationProvider) {
  return db.integration.findUnique({
    where: { userId_provider: { userId, provider } },
  });
}

export async function getValidToken(userId: string, provider: IntegrationProvider) {
  const row = await getIntegration(userId, provider);
  if (!row) throw new Error(`Connect ${provider} first in Settings`);

  if (row.expiresAt && row.expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
    if (!row.refreshToken) throw new Error(`${provider} token expired`);
    const refreshed = await refreshAccessToken(provider, row.refreshToken);
    const expiresAt = refreshed.expires_in
      ? new Date(Date.now() + refreshed.expires_in * 1000)
      : null;
    await db.integration.update({
      where: { id: row.id },
      data: {
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token || row.refreshToken,
        expiresAt,
      },
    });
    return refreshed.access_token;
  }
  return row.accessToken;
}
