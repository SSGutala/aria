import type { ExternalLink } from "@/lib/types";

type ArtifactContent = Record<string, unknown>;

export function suggestConnectors(
  artifactType: string
): Array<{ provider: string; label: string; target: string }> {
  const map: Record<string, Array<{ provider: string; label: string; target: string }>> = {
    product_brief: [
      { provider: "google", label: "Google Docs", target: "google_docs" },
    ],
    workflow_map: [
      { provider: "lucidchart", label: "Lucidchart", target: "lucidchart" },
    ],
    workflow_diagram: [
      { provider: "lucidchart", label: "Lucidchart", target: "lucidchart" },
    ],
    data_model: [
      { provider: "google", label: "Google Sheets", target: "google_sheets" },
    ],
    roadmap: [
      { provider: "google", label: "Google Slides", target: "google_slides" },
    ],
    ux_recommendation: [
      { provider: "figma", label: "Figma", target: "figma" },
    ],
    app_spec: [
      { provider: "google", label: "Google Docs", target: "google_docs" },
    ],
  };
  return map[artifactType] || [
    { provider: "google", label: "Google Docs", target: "google_docs" },
  ];
}

export function parseArtifactContent(raw: string): ArtifactContent {
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return { body: raw };
  }
}

export function parseExternalLinks(raw: string): ExternalLink[] {
  try {
    return JSON.parse(raw || "[]");
  } catch {
    return [];
  }
}

export function contentToPlainText(content: ArtifactContent): string {
  if (typeof content.body === "string") return content.body;
  if (Array.isArray(content.sections)) {
    return content.sections
      .map((s: { title?: string; body?: string; bullets?: string[] }) => {
        const parts = [s.title, s.body].filter(Boolean);
        if (s.bullets?.length) parts.push(s.bullets.map((b) => `• ${b}`).join("\n"));
        return parts.join("\n\n");
      })
      .join("\n\n---\n\n");
  }
  return JSON.stringify(content, null, 2);
}

export function contentToSheetRows(content: ArtifactContent): string[][] {
  if (Array.isArray(content.rows)) return content.rows as string[][];
  if (Array.isArray(content.fields)) {
    return [
      ["Field", "Type", "Required", "Notes"],
      ...(content.fields as Array<Record<string, string>>).map((f) => [
        f.name || "",
        f.type || "",
        f.required ? "yes" : "no",
        f.description || "",
      ]),
    ];
  }
  return [["Key", "Value"], ...Object.entries(content).map(([k, v]) => [k, String(v)])];
}

export function contentToSlides(content: ArtifactContent) {
  if (Array.isArray(content.slides)) return content.slides as Array<{ title: string; bullets: string[] }>;
  if (Array.isArray(content.phases)) {
    return (content.phases as Array<{ name: string; items?: string[] }>).map((p) => ({
      title: p.name,
      bullets: p.items || [],
    }));
  }
  return [{ title: "Overview", bullets: [contentToPlainText(content).slice(0, 500)] }];
}
