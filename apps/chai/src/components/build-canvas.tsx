"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
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

type Props = {
  projectId: string;
  userId: string;
  title: string;
  status: string;
  artifacts: Artifact[];
  variants: Variant[];
  activeTab?: string;
};

const TABS = [
  { id: "preview", label: "Preview" },
  { id: "artifacts", label: "Artifacts" },
  { id: "designs", label: "Designs" },
  { id: "code", label: "Code" },
] as const;

export function BuildCanvas({
  projectId,
  userId,
  title,
  status,
  artifacts,
  variants,
  activeTab: initialTab,
}: Props) {
  const [tab, setTab] = useState(
    initialTab || (status === "designs" ? "designs" : "preview")
  );

  useEffect(() => {
    if (status === "build") setTab("preview");
    if (status === "artifacts") setTab("artifacts");
    if (status === "designs") setTab("designs");
  }, [status]);

  const selectedVariant =
    variants.find((v) => v.selected) || variants[0] || null;

  const previewHtml =
    selectedVariant?.previewHtml ||
    `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      *{box-sizing:border-box;margin:0;padding:0;font-family:system-ui,sans-serif}
      body{min-height:100vh;background:#0a0a0a;color:#e5e5e5;display:flex;align-items:center;justify-content:center;padding:40px}
      .card{max-width:420px;text-align:center;border:1px solid #2a2a2a;border-radius:16px;padding:32px;background:#111}
      h1{font-size:20px;margin-bottom:8px}
      p{color:#a3a3a3;font-size:14px;line-height:1.5}
      .dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#f43f7e;margin-right:6px;animation:pulse 1.4s ease-in-out infinite}
      @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
    </style></head><body><div class="card"><h1><span class="dot"></span>${title}</h1><p>Select a design direction, then say <strong>build</strong> in chat to open the live preview.</p></div></body></html>`;

  return (
    <div className="flex h-full min-w-0 flex-[1.4] flex-col border-l border-chai-border bg-chai-surface">
      <div className="flex items-center gap-1.5 border-b border-chai-border px-3 py-2.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-lg border px-3.5 py-1.5 text-xs font-medium transition-colors",
              tab === t.id
                ? "border-chai-border-subtle bg-chai-panel text-chai-text"
                : "border-transparent text-chai-muted hover:text-chai-subtle"
            )}
          >
            {t.label}
          </button>
        ))}
        <span className="ml-auto truncate pr-2 text-xs text-chai-muted">
          {title}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === "preview" && (
          <div className="h-full bg-[#0a0a0a] p-3">
            <div className="h-full overflow-hidden rounded-lg border border-chai-border">
              <iframe
                title="App preview"
                srcDoc={previewHtml}
                className="h-full w-full border-0 bg-white"
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        )}

        {tab === "artifacts" && (
          <div className="h-full space-y-8 overflow-y-auto p-4">
            {artifacts.map((a) => (
              <div
                key={a.id}
                className="rounded-xl border border-chai-border bg-chai-panel p-4"
              >
                <ArtifactViewer
                  projectId={projectId}
                  artifact={a}
                  userId={userId}
                />
              </div>
            ))}
          </div>
        )}

        {tab === "designs" && (
          <div className="h-full overflow-y-auto p-4">
            <ProjectDesignsTab
              projectId={projectId}
              userId={userId}
              variants={variants}
            />
          </div>
        )}

        {tab === "code" && (
          <div className="h-full overflow-y-auto p-4 font-mono text-xs">
            <p className="mb-3 text-chai-subtle">
              Generated app source will appear here after build. For now, review
              artifacts and design mockups.
            </p>
            {artifacts
              .filter((a) => a.type === "app_spec")
              .map((a) => (
                <pre
                  key={a.id}
                  className="overflow-x-auto rounded-lg border border-chai-border bg-chai-bg p-4 text-chai-subtle"
                >
                  {a.content}
                </pre>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
