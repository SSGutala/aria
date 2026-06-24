import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const projects = await db.project.findMany({
    orderBy: { updatedAt: "desc" },
    take: 24,
    select: {
      id: true,
      title: true,
      status: true,
      updatedAt: true,
    },
  });
  return NextResponse.json({ projects });
}
