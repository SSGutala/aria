import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const messages = await db.message.findMany({
    where: { projectId: params.id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ messages });
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  const project = await db.project.findUnique({ where: { id: params.id } });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const userMsg = await db.message.create({
    data: {
      projectId: params.id,
      role: "user",
      content,
      stage: project.status,
    },
  });

  const lower = content.toLowerCase();
  let reply =
    "Noted — I'll keep iterating on artifacts and designs. Switch tabs on the right to review, or describe a specific change.";
  let nextStatus = project.status;

  if (
    lower.includes("build") ||
    lower.includes("ship") ||
    lower.includes("preview")
  ) {
    reply =
      "Opening the live preview with your selected design direction. You can keep editing via chat — describe UI or workflow changes anytime.";
    nextStatus = "build";
  } else if (
    lower.includes("design") ||
    lower.includes("mockup") ||
    lower.includes("style")
  ) {
    reply =
      "Check the Designs tab — pick one or more mockups, then tell me what to refine (colors, layout, density).";
    nextStatus = "designs";
  } else if (
    lower.includes("artifact") ||
    lower.includes("brief") ||
    lower.includes("prd") ||
    lower.includes("workflow")
  ) {
    reply =
      "Artifacts are in the right panel. Tell me which section to expand — brief, workflow, data model, or app spec.";
    nextStatus = "artifacts";
  }

  if (nextStatus !== project.status) {
    await db.project.update({
      where: { id: params.id },
      data: { status: nextStatus },
    });
  }

  const assistantMsg = await db.message.create({
    data: {
      projectId: params.id,
      role: "assistant",
      content: reply,
      stage: nextStatus,
    },
  });

  return NextResponse.json({
    messages: [userMsg, assistantMsg],
    status: nextStatus,
  });
}
