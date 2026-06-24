import { NextResponse } from "next/server";
import { createProjectFromPrompt } from "@/lib/create-project";

export async function POST() {
  const { userId, projectId } = await createProjectFromPrompt(
    "Build an expense approval hub with manager and finance review steps, audit trail, and email notifications."
  );

  return NextResponse.json({ userId, projectId });
}
