import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { variantIds } = (await req.json()) as { variantIds?: string[] };
  if (!variantIds) {
    return NextResponse.json({ error: "variantIds required" }, { status: 400 });
  }

  await db.designVariant.updateMany({
    where: { projectId: params.id },
    data: { selected: false },
  });
  if (variantIds.length) {
    await db.designVariant.updateMany({
      where: { id: { in: variantIds }, projectId: params.id },
      data: { selected: true },
    });
  }

  return NextResponse.json({ ok: true });
}
