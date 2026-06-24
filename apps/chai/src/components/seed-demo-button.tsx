"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SeedDemoButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const seed = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Seed failed");
      router.push(`/projects/${data.projectId}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Seed failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={seed}
      disabled={loading}
      className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
    >
      {loading ? "Creating…" : "Create demo project"}
    </button>
  );
}
