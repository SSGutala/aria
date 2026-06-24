import { NextRequest, NextResponse } from "next/server";
import { connectDesignVariant } from "@/lib/integrations/connect";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; variantId: string } }
) {
  const body = await req.json();
  const { userId } = body as { userId?: string };
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  try {
    const result = await connectDesignVariant(userId, params.variantId);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Figma connect failed" },
      { status: 500 }
    );
  }
}
