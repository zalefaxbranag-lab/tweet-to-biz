import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { iteratePlan } from "@/lib/ai";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        analyses: { include: { tweet: true } },
        iterations: { orderBy: { version: "desc" } },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json(project);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch project";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const project = await prisma.project.findUnique({
      where: { id },
      include: { analyses: { include: { tweet: true } } },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Handle status update
    if (body.status) {
      const updated = await prisma.project.update({
        where: { id },
        data: { status: body.status },
      });
      return NextResponse.json(updated);
    }

    // Handle iteration with feedback
    if (body.feedback) {
      const tweetContent = project.analyses[0]?.tweet?.content || "";
      const result = await iteratePlan(project.plan, body.feedback, tweetContent);

      // Count existing iterations
      const iterationCount = await prisma.iteration.count({
        where: { projectId: id },
      });

      // Create iteration record
      const iteration = await prisma.iteration.create({
        data: {
          projectId: id,
          version: iterationCount + 1,
          plan: JSON.stringify(result.plan),
          feedback: body.feedback,
          score: result.score,
          changes: result.weaknesses,
        },
      });

      // Update project with new plan
      const updated = await prisma.project.update({
        where: { id },
        data: {
          plan: JSON.stringify(result.plan),
          score: result.score,
          description: result.summary,
        },
        include: {
          analyses: { include: { tweet: true } },
          iterations: { orderBy: { version: "desc" } },
        },
      });

      return NextResponse.json({ project: updated, iteration });
    }

    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update project";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
