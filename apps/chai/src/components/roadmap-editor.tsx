"use client";

import type { RoadmapTask } from "@/lib/types";

type Props = {
  tasks: RoadmapTask[];
  readOnly?: boolean;
  onChange?: (tasks: RoadmapTask[]) => void;
};

export function RoadmapEditor({ tasks, readOnly, onChange }: Props) {
  const update = (id: string, field: keyof RoadmapTask, value: string | number) => {
    if (readOnly) return;
    const next = tasks.map((t) =>
      t.id === id ? { ...t, [field]: value } : t
    );
    onChange?.(next);
  };

  return (
    <div className="overflow-auto rounded-xl border border-slate-200">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left">
          <tr>
            <th className="px-3 py-2">Task</th>
            <th className="px-3 py-2">Phase</th>
            <th className="px-3 py-2">Start</th>
            <th className="px-3 py-2">Weeks</th>
            <th className="px-3 py-2">Owner</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.id} className="border-t border-slate-100">
              {(["title", "phase", "owner"] as const).map((f) => (
                <td key={f} className="px-3 py-2">
                  <input
                    className="w-full bg-transparent outline-none"
                    value={String(t[f] || "")}
                    readOnly={readOnly}
                    onChange={(e) => update(t.id, f, e.target.value)}
                  />
                </td>
              ))}
              <td className="px-3 py-2">
                <input
                  type="number"
                  className="w-16 bg-transparent outline-none"
                  value={t.startWeek}
                  readOnly={readOnly}
                  onChange={(e) => update(t.id, "startWeek", Number(e.target.value))}
                />
              </td>
              <td className="px-3 py-2">
                <input
                  type="number"
                  className="w-16 bg-transparent outline-none"
                  value={t.durationWeeks}
                  readOnly={readOnly}
                  onChange={(e) =>
                    update(t.id, "durationWeeks", Number(e.target.value))
                  }
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
