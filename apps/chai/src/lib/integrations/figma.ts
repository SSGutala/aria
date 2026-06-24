import type { MockupSpec } from "@/lib/types";

/** Parse static mockup HTML into a frame spec for Figma handoff comments */
export function mockupHtmlToSpec(html: string, title: string): MockupSpec {
  const widthMatch = html.match(/width:\s*(\d+)px/i);
  const heightMatch = html.match(/height:\s*(\d+)px/i);
  const bgMatch = html.match(/background(?:-color)?:\s*([^;}"']+)/i);

  const width = widthMatch ? Number(widthMatch[1]) : 1280;
  const height = heightMatch ? Number(heightMatch[1]) : 800;
  const background = bgMatch ? bgMatch[1].trim() : "#0f172a";

  const frames: MockupSpec["frames"] = [];
  const blockRe =
    /<(?:div|section|header|main|nav|aside)[^>]*class="([^"]*)"[^>]*>([\s\S]*?)<\/(?:div|section|header|main|nav|aside)>/gi;
  let m: RegExpExecArray | null;
  let idx = 0;
  while ((m = blockRe.exec(html)) !== null && idx < 24) {
    const cls = m[1];
    const inner = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const text = inner.slice(0, 120) || cls;
    frames.push({
      name: cls.split(/\s+/)[0] || `Frame ${idx + 1}`,
      x: 40 + (idx % 3) * 280,
      y: 40 + Math.floor(idx / 3) * 180,
      width: 240,
      height: 140,
      fill: idx === 0 ? "#1e293b" : "#334155",
      text,
      fontSize: 14,
    });
    idx++;
  }

  if (frames.length === 0) {
    frames.push({
      name: "Screen",
      x: 0,
      y: 0,
      width,
      height,
      fill: background,
      text: title,
      fontSize: 24,
    });
  }

  return { title, width, height, background, frames };
}

export function buildFigmaEmbedUrl(fileKey: string, nodeId?: string) {
  const base = `https://www.figma.com/embed?embed_host=chai&url=`;
  const fileUrl = nodeId
    ? `https://www.figma.com/file/${fileKey}?node-id=${encodeURIComponent(nodeId)}`
    : `https://www.figma.com/file/${fileKey}`;
  return base + encodeURIComponent(fileUrl);
}

export async function postFigmaComment(
  accessToken: string,
  fileKey: string,
  message: string
) {
  const res = await fetch(
    `https://api.figma.com/v1/files/${fileKey}/comments`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.err || err.message || "Figma comment failed");
  }
  return res.json();
}
