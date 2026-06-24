"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUp,
  Clapperboard,
  FolderKanban,
  LayoutDashboard,
  Loader2,
  Receipt,
  UserCheck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ChaiLogo, ChaiMark } from "./chai-logo";
import { cn } from "@/lib/cn";

type ProjectSummary = {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
};

const SUGGESTIONS: { label: string; prompt: string; icon: LucideIcon }[] = [
  {
    label: "Build an approval workflow",
    prompt:
      "Build an approval workflow tool with role-based routing, manager and finance steps, and automatic notifications.",
    icon: UserCheck,
  },
  {
    label: "Build an admin dashboard",
    prompt:
      "Build an admin dashboard with KPI cards, activity feed, user management, and role-based navigation.",
    icon: LayoutDashboard,
  },
  {
    label: "Build a kanban board",
    prompt:
      "Build a kanban board for tracking requests across submitted, in review, approved, and done columns.",
    icon: FolderKanban,
  },
  {
    label: "Build an expense tracker",
    prompt:
      "Build an expense approval hub where employees submit requests, managers approve, finance pays, with a full audit trail.",
    icon: Receipt,
  },
  {
    label: "Build a leave portal",
    prompt:
      "Build a leave request portal with calendar view, manager approval queue, and team coverage visibility.",
    icon: Users,
  },
  {
    label: "Build a vendor onboarding tool",
    prompt:
      "Build a vendor onboarding workflow with intake forms, document collection, and compliance checklist tracking.",
    icon: Clapperboard,
  },
];

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `about ${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `about ${days} day${days === 1 ? "" : "s"} ago`;
}

export function HomePrompt() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [isMac, setIsMac] = useState(true);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform));
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => setProjects(d.projects || []))
      .catch(() => setProjects([]));
  }, []);

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
    <div className="flex min-h-screen flex-col bg-chai-bg">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-4">
        <ChaiLogo size="md" href="/" />
        <div className="flex items-center gap-2.5">
          <span className="text-sm text-chai-subtle">Demo User</span>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-chai-panel text-xs font-medium text-chai-text ring-1 ring-chai-border">
            D
          </div>
        </div>
      </header>

      {/* Hero + prompt */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-10 pt-4">
        <div className="mb-8 flex flex-col items-center text-center">
          <ChaiLogo size="hero" href={null} showText={false} className="mb-5" />
          <h1 className="text-3xl font-semibold tracking-tight text-chai-text sm:text-4xl">
            Build something with{" "}
            <span className="text-chai-pink">chai</span>
          </h1>
          <p className="mt-3 max-w-md text-sm text-chai-muted sm:text-base">
            Create apps and workflows by chatting with AI
          </p>
        </div>

        <div className="relative w-full max-w-2xl rounded-2xl border border-chai-border bg-chai-surface">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                create(prompt);
              }
            }}
            placeholder="What would you like to build?"
            rows={5}
            disabled={loading}
            className="w-full resize-none bg-transparent px-5 pb-12 pt-5 text-[15px] text-chai-text placeholder:text-chai-muted focus:outline-none disabled:opacity-60"
          />
          <div className="absolute bottom-3 left-4 text-xs text-chai-muted">
            {isMac ? "⌘" : "Ctrl+"} Enter to submit
          </div>
          <button
            type="button"
            onClick={() => create(prompt)}
            disabled={!prompt.trim() || loading}
            className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-chai-pink text-white transition-opacity disabled:opacity-40"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <ArrowUp size={18} />
            )}
          </button>
        </div>

        <div className="mt-5 flex w-full max-w-2xl flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.label}
                type="button"
                disabled={loading}
                onClick={() => create(s.prompt)}
                className="inline-flex items-center gap-2 rounded-full border border-chai-border bg-chai-surface px-3.5 py-2 text-xs text-chai-subtle transition-colors hover:border-chai-border-subtle hover:bg-chai-panel hover:text-chai-text disabled:opacity-50"
              >
                <Icon size={14} className="text-chai-muted" />
                {s.label}
              </button>
            );
          })}
        </div>
      </main>

      {/* Recent projects */}
      {projects.length > 0 && (
        <section className="border-t border-chai-border px-6 py-10">
          <div className="mx-auto max-w-4xl">
            <h2 className="mb-5 text-lg font-semibold text-chai-text">
              Demo&apos;s Projects
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((p) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className={cn(
                    "group flex items-start gap-3 rounded-xl border border-chai-border bg-chai-surface p-4 transition-colors",
                    "hover:border-chai-border-subtle hover:bg-chai-panel"
                  )}
                >
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-chai-bg ring-1 ring-chai-border">
                    <ChaiMark />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-chai-text group-hover:text-white">
                      {p.title}
                    </p>
                    <p className="mt-1 text-xs text-chai-muted">
                      {relativeTime(p.updatedAt)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
