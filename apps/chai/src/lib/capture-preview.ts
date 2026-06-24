"use client";

import { toPng } from "html-to-image";

export async function captureIframeToPng(
  iframe: HTMLIFrameElement
): Promise<string> {
  const doc = iframe.contentDocument;
  if (!doc?.body) throw new Error("Preview not loaded");
  return toPng(doc.body, {
    width: 1280,
    height: 800,
    pixelRatio: 1,
    cacheBust: true,
  });
}

export async function saveVariantPreviewImage(
  projectId: string,
  variantId: string,
  dataUrl: string
) {
  const res = await fetch(
    `/api/projects/${projectId}/designs/${variantId}/capture`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl }),
    }
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to save preview image");
  }
  return res.json();
}
