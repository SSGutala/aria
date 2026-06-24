"use client";

import { useState } from "react";

type Props = {
  rows: string[][];
  readOnly?: boolean;
  onChange?: (rows: string[][]) => void;
};

export function SpreadsheetEditor({ rows, readOnly, onChange }: Props) {
  const [data, setData] = useState(rows.length ? rows : [["", ""]]);

  const update = (r: number, c: number, val: string) => {
    if (readOnly) return;
    const next = data.map((row) => [...row]);
    while (next.length <= r) next.push(Array(next[0]?.length || 2).fill(""));
    while (next[r].length <= c) next[r].push("");
    next[r][c] = val;
    setData(next);
    onChange?.(next);
  };

  const cols = Math.max(...data.map((r) => r.length), 2);

  return (
    <div className="overflow-auto rounded-xl border border-slate-200">
      <table className="min-w-full text-sm">
        <tbody>
          {data.map((row, ri) => (
            <tr key={ri}>
              {Array.from({ length: cols }).map((_, ci) => (
                <td key={ci} className="border border-slate-100 p-0">
                  <input
                    className="w-full min-w-[120px] bg-white px-2 py-2 outline-none"
                    value={row[ci] || ""}
                    readOnly={readOnly}
                    onChange={(e) => update(ri, ci, e.target.value)}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
