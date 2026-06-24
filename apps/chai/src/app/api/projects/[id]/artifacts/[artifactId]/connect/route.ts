import { NextRequest, NextResponse } from "next/server";
import { connectArtifact, type ConnectTarget } from "@/lib/integrations/connect";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; artifactId: string } }
) {
  const body = await req.json();
  const { userId, target } = body as { userId?: string; target?: ConnectTarget };
  if (!userId || !target) {
    return NextResponse.json({ error: "userId and target required" }, { status: 400 });
  }

  try {
    const link = await connectArtifact(userId, params.artifactId, target);
    return NextResponse.json({ link });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Connect failed" },
      { status: 500 }
    );
  }
}
