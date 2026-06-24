import Link from "next/link";
import { INTEGRATION_PROVIDERS } from "@/lib/types";
import { OAUTH_CONFIGS } from "@/lib/integrations/store";
import { ChaiLogo } from "@/components/chai-logo";

export default function SettingsPage({
  searchParams,
}: {
  searchParams: { connected?: string; userId?: string };
}) {
  const userId = searchParams.userId || "demo-user-replace-me";
  const connected = searchParams.connected;

  return (
    <main className="min-h-screen bg-chai-bg">
      <header className="border-b border-chai-border px-6 py-4">
        <ChaiLogo size="sm" href="/" />
      </header>
      <div className="mx-auto max-w-2xl space-y-6 p-8">
        <Link href="/" className="text-sm text-chai-pink hover:text-chai-pink-soft">
          ← Back
        </Link>
        <h1 className="text-2xl font-semibold text-chai-text">Integrations</h1>
        <p className="text-sm text-chai-subtle">
          Connect OAuth providers. Add credentials to <code className="text-chai-text">.env.local</code> per{" "}
          <code className="text-chai-text">.env.example</code>.
        </p>
        {connected && (
          <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            Connected: {connected}
          </p>
        )}
        <ul className="space-y-3">
          {INTEGRATION_PROVIDERS.map((p) => (
            <li
              key={p}
              className="flex items-center justify-between rounded-xl border border-chai-border bg-chai-surface p-4"
            >
              <div>
                <p className="font-medium text-chai-text">{OAUTH_CONFIGS[p].label}</p>
                <p className="text-xs text-chai-muted">{p}</p>
              </div>
              <a
                href={`/api/integrations/${p}/auth?userId=${encodeURIComponent(userId)}`}
                className="rounded-lg bg-chai-pink px-4 py-2 text-sm text-white hover:bg-chai-pink-soft"
              >
                Connect
              </a>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
