import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { WorkspaceClient } from "@/components/workspace-client";

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
      messages: { orderBy: { createdAt: "asc" } },
      user: true,
    },
  });
  if (!project) notFound();

  const tabMap: Record<string, string> = {
    artifacts: "artifacts",
    designs: "designs",
    preview: "preview",
    code: "code",
  };
  const initialTab = tabMap[searchParams.tab || ""] || undefined;

  return (
    <WorkspaceClient
      projectId={project.id}
      userId={project.userId}
      title={project.title}
      status={project.status}
      artifacts={project.artifacts}
      variants={project.designVariants}
      messages={project.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        stage: m.stage,
        createdAt: m.createdAt.toISOString(),
      }))}
      initialTab={initialTab}
    />
  );
}
