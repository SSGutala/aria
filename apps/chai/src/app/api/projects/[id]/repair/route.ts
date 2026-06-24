import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * App repair endpoint — server-only. Do NOT import React Flow, diagram editors,
 * or any "use client" components here (causes d3-selection vendor-chunk crashes).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = await db.project.findUnique({ where: { id: params.id } });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const { errorText, editRequest } = body as {
    errorText?: string;
    editRequest?: string;
  };

  if (!errorText && !editRequest) {
    return NextResponse.json(
      { error: "errorText or editRequest required" },
      { status: 400 }
    );
  }

  // Placeholder: wire to your app-generation pipeline when available.
  // This route intentionally stays free of client/diagram dependencies.
  return NextResponse.json({
    ok: true,
    projectId: params.id,
    message:
      "Repair queued (stub). Connect your codegen pipeline here — keep this file server-only.",
    received: { errorText: errorText?.slice(0, 500), editRequest },
  });
}
