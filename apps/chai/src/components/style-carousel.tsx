"use client";

import { useState } from "react";

type Variant = {
  id: string;
  name: string;
  styleKey: string;
  previewHtml?: string | null;
  selected: boolean;
};

type Props = {
  variants: Variant[];
  onSelectionChange: (ids: string[]) => void;
};

export function StyleCarousel({
  variants,
  onSelectionChange,
}: Props) {
  const [active, setActive] = useState(0);
  const current = variants[active];

  const toggle = (id: string) => {
    const selected = variants.filter((v) => v.selected).map((v) => v.id);
    const next = selected.includes(id)
      ? selected.filter((x) => x !== id)
      : [...selected, id];
    onSelectionChange(next);
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
              i === active ? "border-indigo-500 bg-indigo-50" : "border-slate-200"
            }`}
          >
            {v.name}
            {v.selected && " ✓"}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
        <iframe
          title={current.name}
          srcDoc={current.previewHtml || ""}
          className="h-[480px] w-full border-0 bg-white"
          sandbox="allow-same-origin"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => toggle(current.id)}
          className={`rounded-lg px-4 py-2 text-sm ${
            current.selected
              ? "bg-indigo-600 text-white"
              : "border border-slate-200 bg-white"
          }`}
        >
          {current.selected ? "Selected for build" : "Select for build"}
        </button>
      </div>
      <p className="text-xs text-slate-500">
        Static HTML mockups — multi-select styles, then build the full app.
      </p>
    </div>
  );
}
