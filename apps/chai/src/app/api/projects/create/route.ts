import { NextResponse } from "next/server";
import { createProjectFromPrompt } from "@/lib/create-project";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    const { userId, projectId } = await createProjectFromPrompt(prompt);
    return NextResponse.json({ userId, projectId });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Create failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
