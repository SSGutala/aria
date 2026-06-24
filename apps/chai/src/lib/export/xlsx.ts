import * as XLSX from "xlsx";

export function buildXlsxBuffer(rows: string[][]): Buffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

export function buildRoadmapXlsx(
  tasks: Array<{
    title: string;
    phase: string;
    startWeek: number;
    durationWeeks: number;
    owner?: string;
    status?: string;
  }>
): Buffer {
  const rows = [
    ["Task", "Phase", "Start Week", "Duration (weeks)", "Owner", "Status"],
    ...tasks.map((t) => [
      t.title,
      t.phase,
      String(t.startWeek),
      String(t.durationWeeks),
      t.owner || "",
      t.status || "planned",
    ]),
  ];
  return buildXlsxBuffer(rows);
}
