import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; variantId: string } }
) {
  const body = await req.json();
  const { dataUrl } = body as { dataUrl?: string };

  const variant = await db.designVariant.findUnique({
    where: { id: params.variantId },
  });
  if (!variant) {
    return NextResponse.json({ error: "Variant not found" }, { status: 404 });
  }

  if (!dataUrl) {
    return NextResponse.json({ error: "dataUrl required" }, { status: 400 });
  }

  await db.designVariant.update({
    where: { id: params.variantId },
    data: { previewImage: dataUrl },
  });

  return NextResponse.json({ ok: true, previewImage: dataUrl });
}
