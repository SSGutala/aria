import type { FlowEdge, FlowNode, RoadmapTask } from "@/lib/types";

type LucidShape = {
  id: string;
  type: string;
  boundingBox: { x: number; y: number; w: number; h: number };
  text?: string;
  style?: Record<string, unknown>;
};

type LucidLine = {
  id: string;
  lineType: string;
  endpoint1: { style: string; connectedTo: string };
  endpoint2: { style: string; connectedTo: string };
  text?: string;
};

export function flowToLucidImport(
  title: string,
  nodes: FlowNode[],
  edges: FlowEdge[]
) {
  const shapes: LucidShape[] = nodes.map((n, i) => ({
    id: n.id,
    type: "rectangle",
    boundingBox: {
      x: n.x ?? 80 + (i % 4) * 220,
      y: n.y ?? 80 + Math.floor(i / 4) * 140,
      w: 180,
      h: 72,
    },
    text: n.label,
    style: { fill: { type: "color", color: "#EEF2FF" } },
  }));

  const lines: LucidLine[] = edges.map((e) => ({
    id: e.id,
    lineType: "straight",
    endpoint1: { style: "none", connectedTo: e.source },
    endpoint2: { style: "arrow", connectedTo: e.target },
    text: e.label,
  }));

  return {
    version: 1,
    title,
    pages: [
      {
        id: "page1",
        title: "Page 1",
        shapes,
        lines,
      },
    ],
  };
}

export function roadmapToLucidImport(title: string, tasks: RoadmapTask[]) {
  const shapes: LucidShape[] = tasks.map((t, i) => ({
    id: t.id,
    type: "rectangle",
    boundingBox: {
      x: 60 + t.startWeek * 100,
      y: 60 + i * 90,
      w: Math.max(t.durationWeeks * 100, 120),
      h: 64,
    },
    text: `${t.title}\n${t.phase}${t.owner ? ` · ${t.owner}` : ""}`,
    style: { fill: { type: "color", color: "#F0FDF4" } },
  }));

  return {
    version: 1,
    title,
    pages: [{ id: "page1", title: "Roadmap", shapes, lines: [] }],
  };
}

/** Build a .lucid zip buffer for Lucid Standard Import multipart upload */
export async function buildLucidZip(documentJson: object): Promise<Buffer> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  zip.file("document.json", JSON.stringify(documentJson));
  const arrayBuffer = await zip.generateAsync({ type: "nodebuffer" });
  return Buffer.from(arrayBuffer);
}

export async function createLucidDocumentWithImport(
  accessToken: string,
  title: string,
  documentJson: object
): Promise<{ documentId: string; editUrl: string; embedUrl: string }> {
  const zipBuffer = await buildLucidZip(documentJson);
  const form = new FormData();
  const blob = new Blob([new Uint8Array(zipBuffer)], {
    type: "application/vnd.lucid.standardImport",
  });
  form.append("file", blob, "import.lucid");
  form.append("title", title);
  form.append("product", "lucidchart");

  const res = await fetch("https://api.lucid.co/v1/documents", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || "Lucid import failed");
  }

  const documentId = data.documentId || data.id;
  const editUrl = data.editUrl || `https://lucid.app/lucidchart/${documentId}/edit`;
  const embedUrl =
    data.embedUrl ||
    `https://lucid.app/documents/embed/${documentId}#border=0&scale=fit`;

  return { documentId, editUrl, embedUrl };
}

/** Legacy empty-doc create (fallback) */
export async function createEmptyLucidDocument(
  accessToken: string,
  title: string
) {
  const res = await fetch("https://api.lucid.co/v1/documents", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ title, product: "lucidchart" }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Lucid create failed");
  const documentId = data.documentId || data.id;
  return {
    documentId,
    editUrl: data.editUrl || `https://lucid.app/lucidchart/${documentId}/edit`,
    embedUrl:
      data.embedUrl ||
      `https://lucid.app/documents/embed/${documentId}#border=0&scale=fit`,
  };
}
