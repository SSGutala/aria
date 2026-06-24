import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ChaiShell } from "@/components/chai-shell";
import { ProjectWorkspace } from "@/components/project-workspace";

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
    <ChaiShell
      title={project.title}
      subtitle={`${project.artifacts.length} artifacts · ${project.designVariants.length} design styles`}
    >
      <ProjectWorkspace
        projectId={project.id}
        userId={project.userId}
        artifacts={project.artifacts}
        designVariants={project.designVariants}
        initialTab={tab}
      />
    </ChaiShell>
  );
}
