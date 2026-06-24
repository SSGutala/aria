"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

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
            className={cn(
              "shrink-0 rounded-lg border px-4 py-2 text-sm transition-colors",
              i === active
                ? "border-chai-pink/50 bg-chai-pink/10 text-chai-text"
                : "border-chai-border text-chai-subtle hover:border-chai-border-subtle"
            )}
          >
            {v.name}
            {v.selected && " ✓"}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-chai-border bg-chai-bg">
        <iframe
          title={current.name}
          srcDoc={current.previewHtml || ""}
          className="h-[420px] w-full border-0 bg-white"
          sandbox="allow-same-origin"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => toggle(current.id)}
          className={cn(
            "rounded-lg px-4 py-2 text-sm transition-colors",
            current.selected
              ? "bg-chai-pink text-white"
              : "border border-chai-border text-chai-subtle hover:border-chai-pink/40"
          )}
        >
          {current.selected ? "Selected for build" : "Select for build"}
        </button>
      </div>
      <p className="text-xs text-chai-muted">
        Static HTML mockups — multi-select styles, then say <strong className="text-chai-subtle">build</strong> in chat.
      </p>
    </div>
  );
}
