"use client";

import { useState } from "react";

type Variant = {
  id: string;
  name: string;
  figmaEmbedUrl?: string | null;
  figmaOpenUrl?: string | null;
  previewImage?: string | null;
};

type Props = {
  projectId: string;
  variant: Variant;
  userId: string;
};

export function DesignHandoffPanel({ projectId, variant, userId }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pluginUrl, setPluginUrl] = useState<string | null>(null);

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
      const base = typeof window !== "undefined" ? window.location.origin : "";
      setPluginUrl(`${base}/api/integrations/figma/plugin-spec?variantId=${variant.id}`);
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connect failed");
    } finally {
      setLoading(false);
    }
  };

  const specUrl =
    pluginUrl ||
    (typeof window !== "undefined"
      ? `${window.location.origin}/api/integrations/figma/plugin-spec?variantId=${variant.id}`
      : "");

  return (
    <div className="chai-card space-y-3 p-4">
      <h3 className="font-semibold text-zinc-100">Figma handoff</h3>
      <p className="text-sm text-zinc-500">
        Connect posts mockup spec to your Figma template. Run the Chai plugin to
        create frames (REST API cannot create Figma files).
      </p>

      {variant.previewImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={variant.previewImage}
          alt="Reference"
          className="max-h-40 rounded-lg border"
        />
      )}

      <button
        type="button"
        onClick={connectFigma}
        disabled={loading}
        className="chai-btn-primary disabled:opacity-50"
      >
        {loading ? "Connecting…" : "Connect Figma"}
      </button>

      {variant.figmaEmbedUrl && (
        <iframe
          src={variant.figmaEmbedUrl}
          title="Figma"
          className="h-[360px] w-full rounded-lg border"
        />
      )}

      {variant.figmaOpenUrl && (
        <a
          href={variant.figmaOpenUrl}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-indigo-600 underline"
        >
          Open in Figma
        </a>
      )}

      <div className="rounded-lg bg-zinc-900 p-3 text-xs text-zinc-500 break-all">
        Plugin spec URL: {specUrl}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
