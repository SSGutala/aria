"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ChaiLanding() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const start = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      router.push(`/projects/${data.projectId}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not start");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[var(--chai-bg)]">
      <header className="flex items-center justify-between border-b border-[var(--chai-border)] px-8 py-5">
        <span className="text-xl font-semibold chai-glare">chai.</span>
        <Link href="/workspace" className="chai-btn-ghost">
          Open workspace
        </Link>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <div className="max-w-2xl">
          <span className="inline-block rounded-full border border-[var(--chai-border)] bg-[var(--chai-surface)] px-3 py-1 text-[10px] uppercase tracking-widest text-zinc-500">
            AI-native enterprise workflow builder
          </span>
          <h1 className="mt-6 text-5xl font-semibold leading-tight tracking-tight text-zinc-50">
            From brief to docs,
            <br />
            <span className="chai-glare">designs to working apps</span>
          </h1>
          <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-zinc-500">
            Chai gathers requirements, generates enterprise artifacts, shows static
            design mockups, then builds — with optional handoff to Google, Microsoft
            365, Lucidchart, and Figma.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={start}
              disabled={loading}
              className="chai-btn-primary disabled:opacity-50"
            >
              {loading ? "Starting…" : "Start a new project"}
            </button>
            <Link href="/workspace" className="chai-btn-ghost">
              View projects
            </Link>
          </div>
        </div>

        <div className="mt-20 flex flex-wrap justify-center gap-8 text-xs text-zinc-600">
          <span>Product briefs</span>
          <span>Workflow diagrams</span>
          <span>Design mockups</span>
          <span>Approval apps</span>
        </div>
      </main>

      <footer className="border-t border-[var(--chai-border)] py-5 text-center text-xs text-zinc-700">
        Chai — artifacts first, connectors when you need them
      </footer>
    </div>
  );
}
