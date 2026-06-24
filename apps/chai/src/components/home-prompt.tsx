"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowUp, Loader2 } from "lucide-react";
import { ChaiLogo } from "./chai-logo";
import { cn } from "@/lib/cn";

const SUGGESTIONS = [
  {
    label: "Approval workflow",
    detail: "Multi-step with roles and notifications",
    prompt:
      "Build an approval workflow tool with role-based routing, manager and finance steps, and automatic notifications.",
  },
  {
    label: "Expense tracker",
    detail: "Submit, review, and audit trail",
    prompt:
      "Build an expense approval hub where employees submit requests, managers approve, finance pays, with a full audit trail.",
  },
  {
    label: "Leave requests",
    detail: "Calendar-aware time-off portal",
    prompt:
      "Build a leave request portal with calendar view, manager approval queue, and team coverage visibility.",
  },
  {
    label: "Vendor onboarding",
    detail: "Forms, docs, and compliance checks",
    prompt:
      "Build a vendor onboarding workflow with intake forms, document collection, and compliance checklist tracking.",
  },
];

export function HomePrompt() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);

  const create = async (text: string) => {
    const value = text.trim();
    if (!value || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/projects/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Create failed");
      router.push(`/projects/${data.projectId}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Create failed");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-chai-bg px-6 py-16">
      <div className="mb-10 text-center">
        <ChaiLogo size="lg" href="/" className="justify-center" />
        <h1 className="mt-6 text-lg font-medium text-chai-text">
          What are we building today?
        </h1>
        <p className="mt-2 text-sm text-chai-muted">
          Describe your need — Chai generates artifacts, designs, then your app.
        </p>
      </div>

      <div className="relative w-full max-w-2xl rounded-2xl border border-chai-border-subtle bg-chai-surface shadow-[0_0_40px_rgba(244,63,126,0.08)]">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              create(prompt);
            }
          }}
          placeholder="Ask Chai to create an internal tool, workflow, or portal…"
          rows={4}
          disabled={loading}
          className="w-full resize-none bg-transparent px-5 py-4 pr-14 text-sm text-chai-text placeholder:text-chai-muted focus:outline-none disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => create(prompt)}
          disabled={!prompt.trim() || loading}
          className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-xl bg-chai-pink text-white transition-opacity disabled:opacity-40"
        >
          {loading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <ArrowUp size={18} />
          )}
        </button>
      </div>

      <div className="mt-10 grid w-full max-w-2xl gap-3 sm:grid-cols-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.label}
            type="button"
            disabled={loading}
            onMouseEnter={() => setHovered(s.label)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => create(s.prompt)}
            className={cn(
              "rounded-xl border px-4 py-3 text-left transition-colors disabled:opacity-50",
              hovered === s.label
                ? "border-chai-pink/40 bg-chai-pink/5"
                : "border-chai-border bg-chai-surface hover:border-chai-border-subtle"
            )}
          >
            <p className="text-sm font-medium text-chai-text">{s.label}</p>
            <p className="mt-0.5 text-xs text-chai-muted">{s.detail}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
