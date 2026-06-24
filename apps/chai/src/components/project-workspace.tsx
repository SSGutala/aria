"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArtifactViewer } from "./artifact-viewer";
import { ProjectDesignsTab } from "./project-designs-tab";

type Artifact = {
  id: string;
  type: string;
  title: string;
  content: string;
  externalLinks: string;
};

type Variant = {
  id: string;
  name: string;
  styleKey: string;
  previewHtml?: string | null;
  previewImage?: string | null;
  selected: boolean;
  figmaEmbedUrl?: string | null;
  figmaOpenUrl?: string | null;
};

const TABS = [
  { key: "artifacts", label: "Artifacts", desc: "Docs, diagrams, roadmap" },
  { key: "designs", label: "Designs", desc: "Mockups & Figma handoff" },
] as const;

export function ProjectWorkspace({
  projectId,
  userId,
  artifacts,
  designVariants,
  initialTab,
}: {
  projectId: string;
  userId: string;
  artifacts: Artifact[];
  designVariants: Variant[];
  initialTab: string;
}) {
  const router = useRouter();
  const tab = initialTab === "designs" ? "designs" : "artifacts";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/projects/${projectId}?tab=${t.key}`}
            className={`rounded-xl px-4 py-3 text-left transition ${
              tab === t.key
                ? "bg-indigo-500/20 ring-1 ring-indigo-400/40"
                : "bg-[var(--chai-surface)] hover:bg-[var(--chai-surface-2)]"
            }`}
          >
            <div className="text-sm font-medium text-zinc-100">{t.label}</div>
            <div className="text-xs text-zinc-500">{t.desc}</div>
          </Link>
        ))}
      </div>

      {tab === "designs" ? (
        <ProjectDesignsTab
          projectId={projectId}
          userId={userId}
          variants={designVariants}
        />
      ) : (
        <div className="space-y-6">
          {artifacts.map((a) => (
            <div key={a.id} className="chai-card p-5 md:p-6">
              <ArtifactViewer
                projectId={projectId}
                artifact={a}
                userId={userId}
                onUpdated={() => router.refresh()}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
