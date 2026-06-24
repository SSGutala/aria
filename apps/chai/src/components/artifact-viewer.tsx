"use client";

import { useState } from "react";
import type { ExternalLink } from "@/lib/types";
import { suggestConnectors } from "@/lib/integrations/suggest";
import { IntegrationEmbed } from "./integration-embed";
import { DocumentEditor } from "./document-editor";
import { FlowDiagramEditor } from "./flow-diagram-editor-lazy";
import { SpreadsheetEditor } from "./spreadsheet-editor";
import { SlidesEditor } from "./slides-editor";
import { RoadmapEditor } from "./roadmap-editor";

type Artifact = {
  id: string;
  type: string;
  title: string;
  content: string;
  externalLinks: string;
};

type Props = {
  projectId: string;
  artifact: Artifact;
  userId: string;
  onUpdated?: () => void;
};

function parseLinks(raw: string): ExternalLink[] {
  try {
    return JSON.parse(raw || "[]");
  } catch {
    return [];
  }
}

function parseContent(raw: string) {
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return { body: raw };
  }
}

export function ArtifactViewer({ projectId, artifact, userId, onUpdated }: Props) {
  const [mode, setMode] = useState<"view" | "manual" | "connected">("view");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const content = parseContent(artifact.content);
  const links = parseLinks(artifact.externalLinks);
  const activeLink = links[links.length - 1];
  const suggestions = suggestConnectors(artifact.type);

  const connect = async (target: string) => {
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/artifacts/${artifact.id}/connect`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, target }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Connect failed");
      setMode("connected");
      onUpdated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connect failed");
    } finally {
      setConnecting(false);
    }
  };

  const renderNative = () => {
    if (artifact.type === "workflow_map" || artifact.type === "workflow_diagram") {
      return (
        <FlowDiagramEditor
          initialNodes={content.flowNodes || content.nodes || []}
          initialEdges={content.flowEdges || content.edges || []}
          readOnly={mode === "view"}
        />
      );
    }
    if (artifact.type === "data_model") {
      return (
        <SpreadsheetEditor
          rows={
            content.fields
              ? [
                  ["Field", "Type", "Required", "Notes"],
                  ...content.fields.map((f: Record<string, string>) => [
                    f.name,
                    f.type,
                    f.required,
                    f.description || "",
                  ]),
                ]
              : content.rows || []
          }
          readOnly={mode === "view"}
        />
      );
    }
    if (artifact.type === "roadmap") {
      return (
        <RoadmapEditor tasks={content.tasks || []} readOnly={mode === "view"} />
      );
    }
    if (content.slides) {
      return <SlidesEditor slides={content.slides} readOnly={mode === "view"} />;
    }
    const html =
      content.body ||
      (content.sections
        ? content.sections
            .map(
              (s: { title?: string; body?: string }) =>
                `<h2>${s.title || ""}</h2><p>${s.body || ""}</p>`
            )
            .join("")
        : "<p></p>");
    return (
      <DocumentEditor content={html} readOnly={mode === "view"} />
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-indigo-500/15 px-3 py-1 text-xs font-medium text-indigo-300">
          {artifact.type}
        </span>
        <h2 className="text-lg font-semibold text-zinc-100">{artifact.title}</h2>
        <div className="ml-auto flex gap-2">
          {(["view", "manual"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                mode === m
                  ? "bg-indigo-500 text-white"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              {m === "view" ? "View" : "Edit"}
            </button>
          ))}
          {activeLink?.embedUrl && (
            <button
              type="button"
              onClick={() => setMode("connected")}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                mode === "connected"
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-800 text-zinc-300"
              }`}
            >
              Connected
            </button>
          )}
        </div>
      </div>

      {mode === "connected" && activeLink?.embedUrl ? (
        <IntegrationEmbed embedUrl={activeLink.embedUrl} title={artifact.title} />
      ) : (
        renderNative()
      )}

      {mode !== "connected" && (
        <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/50 p-4">
          <p className="mb-2 text-sm font-medium text-zinc-300">
            Connect to external editor (optional)
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s.target}
                type="button"
                disabled={connecting}
                onClick={() => connect(s.target)}
                className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 hover:border-indigo-500/50"
              >
                Connect {s.label}
              </button>
            ))}
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          {activeLink && (
            <p className="mt-2 text-xs text-zinc-500">
              Linked:{" "}
              <a href={activeLink.url} className="text-indigo-600 underline" target="_blank" rel="noreferrer">
                Open in {activeLink.provider}
              </a>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
