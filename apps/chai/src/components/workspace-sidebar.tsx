"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Settings } from "lucide-react";
import { ChaiLogo } from "./chai-logo";
import { cn } from "@/lib/cn";

type ProjectSummary = {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
};

type Props = {
  activeProjectId?: string;
  userId?: string;
};

export function WorkspaceSidebar({ activeProjectId, userId }: Props) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => setProjects(d.projects || []))
      .catch(() => setProjects([]));
  }, [activeProjectId]);

  return (
    <aside className="flex h-full w-[220px] shrink-0 flex-col border-r border-chai-border bg-chai-surface">
      <div className="flex items-center justify-between border-b border-chai-border px-4 py-3.5">
        <ChaiLogo size="sm" href="/" />
        <Link
          href="/"
          className="rounded-lg p-1.5 text-chai-muted transition-colors hover:bg-chai-panel hover:text-chai-text"
          title="New project"
        >
          <Plus size={16} />
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-chai-muted">
          Projects
        </p>
        {projects.length === 0 ? (
          <p className="px-2 text-xs text-chai-muted">No projects yet</p>
        ) : (
          <ul className="space-y-0.5">
            {projects.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className={cn(
                    "block rounded-lg px-2.5 py-2 text-sm transition-colors",
                    p.id === activeProjectId
                      ? "bg-chai-panel text-chai-text"
                      : "text-chai-subtle hover:bg-chai-panel/60 hover:text-chai-text"
                  )}
                >
                  <span className="line-clamp-2 leading-snug">{p.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-chai-border p-2">
        <Link
          href={userId ? `/settings?userId=${userId}` : "/settings"}
          className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-chai-subtle transition-colors hover:bg-chai-panel hover:text-chai-text"
        >
          <Settings size={15} />
          Settings
        </Link>
      </div>
    </aside>
  );
}
