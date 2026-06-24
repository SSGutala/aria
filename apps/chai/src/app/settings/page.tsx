import Link from "next/link";
import { INTEGRATION_PROVIDERS } from "@/lib/types";
import { OAUTH_CONFIGS } from "@/lib/integrations/store";

export default function SettingsPage({
  searchParams,
}: {
  searchParams: { connected?: string; userId?: string };
}) {
  const userId = searchParams.userId || "demo-user-replace-me";
  const connected = searchParams.connected;

  return (
    <main className="mx-auto max-w-2xl p-8 space-y-6">
      <Link href="/" className="text-sm text-indigo-600">
        ← Home
      </Link>
      <h1 className="text-2xl font-bold text-slate-900">Integrations</h1>
      <p className="text-sm text-slate-600">
        Connect OAuth providers. Add credentials to <code>.env.local</code> per{" "}
        <code>.env.example</code>.
      </p>
      {connected && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Connected: {connected}
        </p>
      )}
      <ul className="space-y-3">
        {INTEGRATION_PROVIDERS.map((p) => (
          <li
            key={p}
            className="flex items-center justify-between rounded-xl border border-slate-200 p-4"
          >
            <div>
              <p className="font-medium">{OAUTH_CONFIGS[p].label}</p>
              <p className="text-xs text-slate-500">{p}</p>
            </div>
            <a
              href={`/api/integrations/${p}/auth?userId=${encodeURIComponent(userId)}`}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white"
            >
              Connect
            </a>
          </li>
        ))}
      </ul>
      <p className="text-xs text-slate-500">
        Pass <code>?userId=</code> from your session after auth is wired. Demo
        seed returns a real user id on project create.
      </p>
    </main>
  );
}
