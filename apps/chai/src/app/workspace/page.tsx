import Link from "next/link";
import { db } from "@/lib/db";
import { ChaiShell } from "@/components/chai-shell";
import { NewProjectButton } from "@/components/new-project-button";

export default async function WorkspacePage() {
  const projects = await db.project.findMany({
    orderBy: { updatedAt: "desc" },
    take: 20,
    include: { _count: { select: { artifacts: true, designVariants: true } } },
  });

  return (
    <ChaiShell title="Projects" subtitle="Your workflow builds">
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          {projects.length} project{projects.length === 1 ? "" : "s"}
        </p>
        <NewProjectButton />
      </div>

      {projects.length === 0 ? (
        <div className="chai-card flex flex-col items-center justify-center px-8 py-20 text-center">
          <p className="text-lg font-medium text-zinc-200">No projects yet</p>
          <p className="mt-2 max-w-md text-sm text-zinc-500">
            Start your first build — Chai will generate artifacts, design mockups,
            and a demo approval workflow you can connect to external tools.
          </p>
          <div className="mt-6">
            <NewProjectButton label="Create first project" />
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="chai-card group block p-5 transition hover:border-indigo-500/40 hover:bg-[var(--chai-surface-2)]"
            >
              <h2 className="font-medium text-zinc-100 group-hover:text-indigo-200">
                {p.title}
              </h2>
              <p className="mt-2 text-xs text-zinc-500">
                {p._count.artifacts} artifacts · {p._count.designVariants} designs
              </p>
              <p className="mt-3 text-[10px] uppercase tracking-wide text-zinc-600">
                {p.status}
              </p>
            </Link>
          ))}
        </div>
      )}
    </ChaiShell>
  );
}
