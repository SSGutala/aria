import Link from "next/link";
import { INTEGRATION_PROVIDERS } from "@/lib/types";
import { OAUTH_CONFIGS } from "@/lib/integrations/store";
import { ChaiShell } from "@/components/chai-shell";

export default function SettingsPage({
  searchParams,
}: {
  searchParams: { connected?: string; userId?: string };
}) {
  const userId = searchParams.userId || "demo-user-replace-me";
  const connected = searchParams.connected;

  return (
    <ChaiShell title="Integrations" subtitle="Connect external editors">
      {connected && (
        <p className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          Connected: {connected}
        </p>
      )}
      <p className="mb-6 text-sm text-zinc-500">
        OAuth credentials go in <code className="text-zinc-400">.env.local</code> — see{" "}
        <code className="text-zinc-400">.env.example</code>.
      </p>
      <ul className="space-y-3">
        {INTEGRATION_PROVIDERS.map((p) => (
          <li
            key={p}
            className="chai-card flex items-center justify-between p-4"
          >
            <div>
              <p className="font-medium text-zinc-100">{OAUTH_CONFIGS[p].label}</p>
              <p className="text-xs text-zinc-500">{p}</p>
            </div>
            <a
              href={`/api/integrations/${p}/auth?userId=${encodeURIComponent(userId)}`}
              className="chai-btn-primary"
            >
              Connect
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-xs text-zinc-600">
        <Link href="/workspace" className="text-indigo-400 hover:underline">
          ← Back to projects
        </Link>
      </p>
    </ChaiShell>
  );
}
