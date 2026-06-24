"use client";

import { useState } from "react";

type Variant = {
  id: string;
  name: string;
  figmaEmbedUrl?: string | null;
  figmaOpenUrl?: string | null;
};

type Props = {
  projectId: string;
  variant: Variant;
  userId: string;
};

export function DesignHandoffPanel({ projectId, variant, userId }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connectFigma = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/designs/${variant.id}/connect`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Figma connect failed");
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connect failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-chai-border bg-chai-panel p-4">
      <h3 className="font-semibold text-chai-text">Figma handoff</h3>
      <p className="text-sm text-chai-subtle">
        Connect posts a mockup spec comment to your Figma template file and
        embeds it here for review.
      </p>

      <button
        type="button"
        onClick={connectFigma}
        disabled={loading}
        className="rounded-lg bg-chai-pink px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {loading ? "Connecting…" : "Connect Figma"}
      </button>

      {variant.figmaEmbedUrl && (
        <iframe
          src={variant.figmaEmbedUrl}
          title="Figma"
          className="h-[360px] w-full rounded-lg border border-chai-border"
        />
      )}

      {variant.figmaOpenUrl && (
        <a
          href={variant.figmaOpenUrl}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-chai-pink underline"
        >
          Open in Figma
        </a>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
