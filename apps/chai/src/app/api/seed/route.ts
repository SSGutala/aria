import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { seedProjectLifecycle } from "@/lib/lifecycle";

export async function POST() {
  const user = await db.user.upsert({
    where: { email: "demo@chai.local" },
    create: { email: "demo@chai.local", name: "Demo User" },
    update: {},
  });

  const project = await db.project.create({
    data: {
      title: "Expense Approval Hub",
      userId: user.id,
      status: "artifacts",
    },
  });

  await seedProjectLifecycle(project.id, project.title);

  return NextResponse.json({ userId: user.id, projectId: project.id });
}
