"use client";

import { useRef, useState } from "react";
import { captureIframeToPng, saveVariantPreviewImage } from "@/lib/capture-preview";

type Variant = {
  id: string;
  name: string;
  styleKey: string;
  previewHtml?: string | null;
  previewImage?: string | null;
  selected: boolean;
};

type Props = {
  projectId: string;
  variants: Variant[];
  onSelectionChange: (ids: string[]) => void;
  onCapture?: () => void;
};

export function StyleCarousel({
  projectId,
  variants,
  onSelectionChange,
  onCapture,
}: Props) {
  const [active, setActive] = useState(0);
  const [capturing, setCapturing] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const current = variants[active];

  const toggle = (id: string) => {
    const selected = variants.filter((v) => v.selected).map((v) => v.id);
    const next = selected.includes(id)
      ? selected.filter((x) => x !== id)
      : [...selected, id];
    onSelectionChange(next);
  };

  const capturePng = async () => {
    if (!iframeRef.current || !current) return;
    setCapturing(true);
    try {
      const dataUrl = await captureIframeToPng(iframeRef.current);
      await saveVariantPreviewImage(projectId, current.id, dataUrl);
      onCapture?.();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Capture failed");
    } finally {
      setCapturing(false);
    }
  };

  if (!current) return null;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto">
        {variants.map((v, i) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setActive(i)}
            className={`shrink-0 rounded-lg border px-4 py-2 text-sm ${
              i === active ? "border-indigo-400 bg-indigo-500/20 text-indigo-100" : "border-zinc-700 text-zinc-400"
            }`}
          >
            {v.name}
            {v.selected && " ✓"}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-700 bg-black">
        {current.previewImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current.previewImage}
            alt={current.name}
            className="mx-auto max-h-[480px] w-full object-contain"
          />
        ) : (
          <iframe
            ref={iframeRef}
            title={current.name}
            srcDoc={current.previewHtml || ""}
            className="h-[480px] w-full border-0 bg-white"
            sandbox="allow-same-origin"
          />
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => toggle(current.id)}
          className={`rounded-lg px-4 py-2 text-sm ${
            current.selected
              ? "bg-indigo-500 text-white"
              : "border border-zinc-700 bg-zinc-800 text-zinc-300"
          }`}
        >
          {current.selected ? "Selected for build" : "Select for build"}
        </button>
        <button
          type="button"
          onClick={capturePng}
          disabled={capturing || !!current.previewImage}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-300 disabled:opacity-50"
        >
          {capturing ? "Capturing…" : "Save PNG reference"}
        </button>
      </div>
      <p className="text-xs text-slate-500">
        Static HTML mockups — multi-select styles, then build the full app.
      </p>
    </div>
  );
}
