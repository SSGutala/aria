import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ArtifactViewer } from "@/components/artifact-viewer";
import { ProjectDesignsTab } from "@/components/project-designs-tab";
import Link from "next/link";

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tab?: string };
}) {
  const project = await db.project.findUnique({
    where: { id: params.id },
    include: {
      artifacts: { orderBy: { sortOrder: "asc" } },
      designVariants: true,
      user: true,
    },
  });
  if (!project) notFound();

  const tab = searchParams.tab || "artifacts";

  return (
    <main className="mx-auto min-h-screen max-w-6xl p-6 space-y-8">
      <header className="flex items-center gap-4">
        <Link href="/" className="text-sm text-indigo-600">
          ← Home
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">{project.title}</h1>
      </header>

      <nav className="flex gap-2">
        {[
          { key: "artifacts", label: "Artifacts" },
          { key: "designs", label: "Designs" },
        ].map((t) => (
          <Link
            key={t.key}
            href={`/projects/${project.id}?tab=${t.key}`}
            className={`rounded-lg px-4 py-2 text-sm ${
              tab === t.key
                ? "bg-indigo-600 text-white"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "designs" ? (
        <ProjectDesignsTab
          projectId={project.id}
          userId={project.userId}
          variants={project.designVariants}
        />
      ) : (
        <div className="space-y-10">
          {project.artifacts.map((a) => (
            <ArtifactViewer
              key={a.id}
              projectId={project.id}
              artifact={a}
              userId={project.userId}
            />
          ))}
        </div>
      )}
    </main>
  );
}
