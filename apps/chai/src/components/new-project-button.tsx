"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function NewProjectButton({ label = "New project" }: { label?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const create = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      router.push(`/projects/${data.projectId}`);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not create project");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={create}
      disabled={loading}
      className="chai-btn-primary disabled:opacity-50"
    >
      {loading ? "Creating…" : label}
    </button>
  );
}
