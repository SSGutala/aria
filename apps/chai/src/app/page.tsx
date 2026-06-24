import Link from "next/link";
import { SeedDemoButton } from "@/components/seed-demo-button";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 p-8">
      <div>
        <p className="text-sm font-medium text-indigo-600">Chai</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">
          AI-native workflow builder
        </h1>
        <p className="mt-3 text-lg text-slate-600">
          Artifacts first — rich native editors, optional connectors to Google,
          Lucidchart, and Figma.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <SeedDemoButton />
        <Link
          href="/settings"
          className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-700"
        >
          Integration settings
        </Link>
      </div>
      <p className="text-sm text-slate-500">
        Dev server: port 4321 · Figma plugin in <code>figma-plugin/</code>
      </p>
    </main>
  );
}
