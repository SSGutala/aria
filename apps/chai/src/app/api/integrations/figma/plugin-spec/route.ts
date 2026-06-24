import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mockupHtmlToSpec, specToPluginPayload } from "@/lib/integrations/figma";

export async function GET(req: NextRequest) {
  const variantId = req.nextUrl.searchParams.get("variantId");
  if (!variantId) {
    return NextResponse.json({ error: "variantId required" }, { status: 400 });
  }

  const variant = await db.designVariant.findUnique({ where: { id: variantId } });
  if (!variant) {
    return NextResponse.json({ error: "Variant not found" }, { status: 404 });
  }

  let spec = variant.figmaSpec ? JSON.parse(variant.figmaSpec) : null;
  if (!spec && variant.previewHtml) {
    spec = mockupHtmlToSpec(variant.previewHtml, variant.name);
  }
  if (!spec) {
    return NextResponse.json({ error: "No mockup spec available" }, { status: 404 });
  }

  if (variant.previewImage) {
    spec.previewImageUrl = variant.previewImage;
  }

  return NextResponse.json(specToPluginPayload(spec));
}
