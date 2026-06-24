import { db } from "@/lib/db";
import { seedProjectLifecycle } from "@/lib/lifecycle";

function titleFromPrompt(prompt: string): string {
  const trimmed = prompt.trim();
  if (trimmed.length <= 48) return trimmed;
  const slice = trimmed.slice(0, 48);
  const lastSpace = slice.lastIndexOf(" ");
  return (lastSpace > 20 ? slice.slice(0, lastSpace) : slice) + "…";
}

async function ensureDemoUser() {
  return db.user.upsert({
    where: { email: "demo@chai.local" },
    create: { email: "demo@chai.local", name: "Demo User" },
    update: {},
  });
}

export async function createProjectFromPrompt(prompt: string) {
  const user = await ensureDemoUser();
  const title = titleFromPrompt(prompt) || "Untitled project";

  const project = await db.project.create({
    data: {
      title,
      userId: user.id,
      status: "artifacts",
    },
  });

  await seedProjectLifecycle(project.id, title);

  await db.message.createMany({
    data: [
      {
        projectId: project.id,
        role: "user",
        content: prompt.trim(),
        stage: "intake",
      },
      {
        projectId: project.id,
        role: "assistant",
        content:
          "Got it — I'll shape this into enterprise artifacts, then generate three design directions you can pick from before we build.",
        stage: "intake",
      },
      {
        projectId: project.id,
        role: "assistant",
        content:
          "Artifacts are ready — product brief, workflow map, data model, roadmap, UX notes, and app spec. Review them in the Artifacts tab, or tell me what to change.",
        stage: "artifacts",
      },
      {
        projectId: project.id,
        role: "assistant",
        content:
          "I've generated three static mockups. Open the Designs tab, multi-select your favorites, and share feedback — then we'll build the full app.",
        stage: "designs",
      },
    ],
  });

  return { userId: user.id, projectId: project.id, project };
}
