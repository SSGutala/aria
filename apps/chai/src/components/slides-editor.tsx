"use client";

import { useState } from "react";

type Slide = { title: string; bullets: string[] };

type Props = {
  slides: Slide[];
  readOnly?: boolean;
  onChange?: (slides: Slide[]) => void;
};

export function SlidesEditor({ slides, readOnly, onChange }: Props) {
  const [items, setItems] = useState<Slide[]>(
    slides.length ? slides : [{ title: "Slide 1", bullets: [""] }]
  );
  const [idx, setIdx] = useState(0);
  const current = items[idx] || items[0];

  const patch = (patch: Partial<Slide>) => {
    if (readOnly) return;
    const next = items.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    setItems(next);
    onChange?.(next);
  };

  return (
    <div className="grid gap-4 md:grid-cols-[200px_1fr]">
      <div className="space-y-2">
        {items.map((s, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIdx(i)}
            className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
              i === idx ? "border-indigo-500 bg-indigo-50" : "border-slate-200"
            }`}
          >
            {s.title || `Slide ${i + 1}`}
          </button>
        ))}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <input
          className="mb-4 w-full text-xl font-semibold outline-none"
          value={current.title}
          readOnly={readOnly}
          onChange={(e) => patch({ title: e.target.value })}
        />
        <textarea
          className="min-h-[200px] w-full resize-y outline-none"
          value={current.bullets.join("\n")}
          readOnly={readOnly}
          onChange={(e) =>
            patch({ bullets: e.target.value.split("\n").filter(Boolean) })
          }
          placeholder="One bullet per line"
        />
      </div>
    </div>
  );
}
