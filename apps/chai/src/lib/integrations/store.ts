import type { IntegrationProvider } from "@/lib/types";

export type OAuthConfig = {
  provider: IntegrationProvider;
  label: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  clientIdEnv: string;
  clientSecretEnv: string;
  extraAuthParams?: Record<string, string>;
};

const appUrl = () =>
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:4321";

export function getRedirectUri(provider: string) {
  return `${appUrl()}/api/integrations/${provider}/callback`;
}

export const OAUTH_CONFIGS: Record<IntegrationProvider, OAuthConfig> = {
  google: {
    provider: "google",
    label: "Google Workspace",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: [
      "https://www.googleapis.com/auth/documents",
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/presentations",
      "https://www.googleapis.com/auth/drive.file",
    ],
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
    extraAuthParams: {
      access_type: "offline",
      prompt: "consent",
    },
  },
  microsoft: {
    provider: "microsoft",
    label: "Microsoft 365",
    authUrl:
      "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scopes: [
      "User.Read",
      "Files.ReadWrite.All",
      "offline_access",
    ],
    clientIdEnv: "MICROSOFT_CLIENT_ID",
    clientSecretEnv: "MICROSOFT_CLIENT_SECRET",
    extraAuthParams: {
      response_mode: "query",
    },
  },
  figma: {
    provider: "figma",
    label: "Figma",
    authUrl: "https://www.figma.com/oauth",
    tokenUrl: "https://www.figma.com/api/oauth/token",
    scopes: ["files:read", "file_comments:write"],
    clientIdEnv: "FIGMA_CLIENT_ID",
    clientSecretEnv: "FIGMA_CLIENT_SECRET",
  },
  lucidchart: {
    provider: "lucidchart",
    label: "Lucidchart",
    authUrl: "https://lucid.app/oauth2/authorize",
    tokenUrl: "https://api.lucid.co/oauth2/token",
    scopes: ["document.content", "offline_access"],
    clientIdEnv: "LUCID_CLIENT_ID",
    clientSecretEnv: "LUCID_CLIENT_SECRET",
  },
};

export function getOAuthCredentials(provider: IntegrationProvider) {
  const cfg = OAUTH_CONFIGS[provider];
  const clientId = process.env[cfg.clientIdEnv];
  const clientSecret = process.env[cfg.clientSecretEnv];
  if (!clientId || !clientSecret) {
    throw new Error(`${cfg.label} OAuth is not configured`);
  }
  return { cfg, clientId, clientSecret };
}

export function buildAuthUrl(
  provider: IntegrationProvider,
  state: string
): string {
  const { cfg, clientId } = getOAuthCredentials(provider);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri(provider),
    response_type: "code",
    scope: cfg.scopes.join(" "),
    state,
    ...cfg.extraAuthParams,
  });
  return `${cfg.authUrl}?${params}`;
}

export async function exchangeCode(
  provider: IntegrationProvider,
  code: string
): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}> {
  const { cfg, clientId, clientSecret } = getOAuthCredentials(provider);
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: getRedirectUri(provider),
  });

  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error_description || data.error || "Token exchange failed");
  }
  return data;
}

export async function refreshAccessToken(
  provider: IntegrationProvider,
  refreshToken: string
): Promise<{ access_token: string; refresh_token?: string; expires_in?: number }> {
  const { cfg, clientId, clientSecret } = getOAuthCredentials(provider);
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error_description || data.error || "Refresh failed");
  }
  return data;
}
